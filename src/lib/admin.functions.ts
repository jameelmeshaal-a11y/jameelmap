// لوحة الإدارة — إحصائيات، إدارة المستخدمين، السجلات
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function assertAdmin(): Promise<{ adminId: string; adminEmail: string }> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { createClient } = await import("@supabase/supabase-js");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const auth = getRequestHeader("authorization") || getRequestHeader("Authorization");
  if (!auth) throw new Error("Unauthorized");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u, error } = await sb.auth.getUser();
  if (error || !u.user) throw new Error("Unauthorized");
  const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
  if (!roleRow || roleRow.role !== "admin") throw new Error("Forbidden: admin only");
  return { adminId: u.user.id, adminEmail: u.user.email ?? "" };
}

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    { count: totalJobs },
    { count: totalResults },
    { count: runningJobs },
    { count: completedJobs },
    { count: failedJobs },
    { data: users },
    { data: recentJobs },
  ] = await Promise.all([
    supabaseAdmin.from("scrape_jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("scrape_results").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("scrape_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
    supabaseAdmin.from("scrape_jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabaseAdmin.from("scrape_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabaseAdmin.from("user_roles").select("user_id, role"),
    supabaseAdmin.from("scrape_jobs").select("created_at, results_count").gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()).order("created_at"),
  ]);

  // اجمع حسب اليوم
  const daily: Record<string, { jobs: number; results: number }> = {};
  for (const r of recentJobs ?? []) {
    const day = new Date(r.created_at as string).toISOString().slice(0, 10);
    if (!daily[day]) daily[day] = { jobs: 0, results: 0 };
    daily[day].jobs++;
    daily[day].results += (r.results_count as number) ?? 0;
  }
  const series = Object.entries(daily).map(([date, v]) => ({ date, ...v }));

  return {
    totals: {
      jobs: totalJobs ?? 0,
      results: totalResults ?? 0,
      running: runningJobs ?? 0,
      completed: completedJobs ?? 0,
      failed: failedJobs ?? 0,
      users: users?.length ?? 0,
    },
    series,
  };
});

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role, created_at");
  const roleMap = new Map((roles ?? []).map((r) => [r.user_id as string, r.role as string]));
  const users = (list?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    role: roleMap.get(u.id) ?? "viewer",
  }));
  return { users };
});

export const createUserWithRole = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(8).max(72),
      role: z.enum(["admin", "manager", "viewer"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { adminEmail } = await assertAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "فشل إنشاء المستخدم");
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await supabaseAdmin.from("audit_log").insert({
      action: "create_user",
      user_email: adminEmail,
      details: { new_user: data.email, role: data.role },
    });
    return { ok: true, userId: created.user.id };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "manager", "viewer"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { adminEmail } = await assertAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      action: "update_role",
      user_email: adminEmail,
      details: { target_user_id: data.userId, new_role: data.role },
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { adminId, adminEmail } = await assertAdmin();
    if (data.userId === adminId) throw new Error("لا يمكنك حذف حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      action: "delete_user",
      user_email: adminEmail,
      details: { target_user_id: data.userId },
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("audit_log")
    .select("id, action, user_email, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return { entries: data ?? [] };
});
