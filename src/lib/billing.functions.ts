// Billing & usage server functions
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Plan = {
  id: string;
  name_ar: string;
  price_sar: number;
  results_per_month: number;
  jobs_per_month: number;
  features: string[];
  sort_order: number;
};

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("plans")
    .select("id, name_ar, price_sar, results_per_month, jobs_per_month, features, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Plan[];
});

export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const month = new Date().toISOString().slice(0, 7);

    const [{ data: sub }, { data: usage }] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("plan_id, status, current_period_end")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("usage_counters")
        .select("results_used, jobs_used")
        .eq("user_id", context.userId)
        .eq("month", month)
        .maybeSingle(),
    ]);

    const planId = (sub?.plan_id as string) ?? "free";
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name_ar, results_per_month, jobs_per_month")
      .eq("id", planId)
      .maybeSingle();

    return {
      plan: plan ?? { id: "free", name_ar: "مجاني", results_per_month: 500, jobs_per_month: 3 },
      usage: {
        month,
        results_used: (usage?.results_used as number) ?? 0,
        jobs_used: (usage?.jobs_used as number) ?? 0,
      },
      subscription_status: (sub?.status as string) ?? "none",
    };
  });
