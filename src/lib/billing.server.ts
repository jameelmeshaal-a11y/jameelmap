// Server-only helpers for usage caps & quota enforcement
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type QuotaCheck = { allowed: boolean; reason?: string; planId: string };

export async function checkAndReserveJobQuota(userId: string): Promise<QuotaCheck> {
  // Admins bypass
  const { data: role } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (role?.role === "admin") return { allowed: true, planId: "admin" };

  const month = new Date().toISOString().slice(0, 7);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions").select("plan_id, status").eq("user_id", userId).maybeSingle();
  const planId = (sub?.plan_id as string) ?? "free";

  const { data: plan } = await supabaseAdmin
    .from("plans").select("jobs_per_month, results_per_month").eq("id", planId).maybeSingle();
  const jobsCap = (plan?.jobs_per_month as number) ?? 3;

  const { data: usage } = await supabaseAdmin
    .from("usage_counters").select("jobs_used").eq("user_id", userId).eq("month", month).maybeSingle();
  const used = (usage?.jobs_used as number) ?? 0;

  if (used >= jobsCap) {
    return { allowed: false, planId, reason: `تجاوزت حد الوظائف الشهري لخطتك (${jobsCap}). يرجى ترقية الباقة.` };
  }

  // Reserve: upsert + increment
  await supabaseAdmin.from("usage_counters").upsert(
    { user_id: userId, month, jobs_used: used + 1 },
    { onConflict: "user_id,month" },
  );

  return { allowed: true, planId };
}

export async function incrementResultsUsed(userId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabaseAdmin
    .from("usage_counters").select("results_used").eq("user_id", userId).eq("month", month).maybeSingle();
  const current = (usage?.results_used as number) ?? 0;
  await supabaseAdmin.from("usage_counters").upsert(
    { user_id: userId, month, results_used: current + count },
    { onConflict: "user_id,month" },
  );
}
