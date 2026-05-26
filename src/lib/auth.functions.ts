// Auth-related server functions: bootstrap first admin
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(8).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // إن وُجد أي admin بالفعل — ارفض
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("يوجد مسؤول مسجّل بالفعل. لا يمكن استخدام هذه الصفحة.");
    }

    // أنشئ المستخدم (أو ابحث عنه إن كان موجوداً)
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr) {
      // ربما المستخدم موجود — حاول إيجاده
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!found) throw new Error(createErr.message);
      userId = found.id;
      // أعد تعيين كلمة المرور
      await supabaseAdmin.auth.admin.updateUserById(found.id, { password: data.password });
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) throw new Error("تعذّر إنشاء/تحديد المستخدم");

    // امنح دور admin
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleErr) throw new Error(roleErr.message);

    // سجّل في audit_log
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      user_email: data.email,
      action: "bootstrap_admin",
      details: {},
    });

    return { ok: true };
  });

export const checkAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
  return { hasAdmin: !!(data && data.length > 0) };
});
