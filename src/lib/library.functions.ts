// Server functions لإدارة مكتبة الوظائف السابقة
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_DB_ROWS, safeWrite } from "@/lib/safe-query";

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("scrape_jobs")
    .select("id, country, activity, status, results_count, cities_done, cities_total, created_at, updated_at, error_message, from_cache")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { jobs: data ?? [] };
});

export const getAggregateStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // إجمالي السجلات + تقدير الفريد عبر place_id distinct (نقرأ كل place_ids بدفعات)
  const seen = new Set<string>();
  let total = 0;
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("scrape_results")
      .select("place_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    total += data.length;
    for (const r of data) {
      const pid = (r as { place_id?: string }).place_id;
      if (pid) seen.add(pid);
    }
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > MAX_DB_ROWS) break;
  }
  return { total, uniquePlaces: seen.size };
});

export const getJobDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string; search?: string }) =>
    z.object({ jobId: z.string().uuid(), search: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("scrape_jobs")
      .select("id, country, activity, status, results_count, created_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    let q = supabaseAdmin
      .from("scrape_results")
      .select("id, name, address, city, state, phone, email, whatsapp, website, facebook, instagram, twitter, youtube, tiktok, snapchat, maps_url")
      .eq("job_id", data.jobId)
      .order("city", { ascending: true })
      .limit(2000);

    if (data.search && data.search.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      q = q.or(`name.ilike.%${s}%,city.ilike.%${s}%,address.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { count: total } = await supabaseAdmin
      .from("scrape_results").select("id", { count: "exact", head: true }).eq("job_id", data.jobId);
    const { count: withEmail } = await supabaseAdmin
      .from("scrape_results").select("id", { count: "exact", head: true }).eq("job_id", data.jobId).neq("email", "");
    const { count: withWebsite } = await supabaseAdmin
      .from("scrape_results").select("id", { count: "exact", head: true }).eq("job_id", data.jobId).neq("website", "");
    const { count: withPhone } = await supabaseAdmin
      .from("scrape_results").select("id", { count: "exact", head: true }).eq("job_id", data.jobId).neq("phone", "");

    return {
      job,
      rows: rows ?? [],
      stats: { total: total ?? 0, withEmail: withEmail ?? 0, withWebsite: withWebsite ?? 0, withPhone: withPhone ?? 0 },
    };
  });

export const getJobCities = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cities, error } = await supabaseAdmin
      .from("scrape_job_cities")
      .select("city, status, results_count, error_message, current_step, updated_at")
      .eq("job_id", data.jobId)
      .order("status", { ascending: true })
      .order("city", { ascending: true });
    if (error) throw new Error(error.message);
    const all = cities ?? [];
    return {
      cities: all,
      failed: all.filter((c) => c.status === "failed"),
      done: all.filter((c) => c.status === "done"),
      pending: all.filter((c) => c.status === "pending" || c.status === "running"),
    };
  });

export const retryFailedCities = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // أعِد فتح المدن الفاشلة فقط (لا نلمس المنجزة)
    const { data: failed } = await supabaseAdmin
      .from("scrape_job_cities")
      .select("city")
      .eq("job_id", data.jobId)
      .eq("status", "failed");
    const count = failed?.length ?? 0;
    if (count === 0) return { reset: 0 };
    await supabaseAdmin
      .from("scrape_job_cities")
      .update({ status: "pending", progress: 0, current_step: "إعادة المحاولة اليدوية", error_message: "" })
      .eq("job_id", data.jobId)
      .eq("status", "failed");
    // أعِد الوظيفة لحالة pending ليلتقطها run-job
    await supabaseAdmin
      .from("scrape_jobs")
      .update({ status: "pending", stopped_at: null, error_message: "" })
      .eq("id", data.jobId);
    return { reset: count };
  });

export const runDedup = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { dedupJob } = await import("@/lib/scrape-engine.server");
    return dedupJob(data.jobId);
  });

export const deleteEmptyJobs = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: empties } = await supabaseAdmin
    .from("scrape_jobs")
    .select("id")
    .eq("results_count", 0)
    .in("status", ["completed", "failed", "stopped"]);
  const ids = (empties ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { removed: 0 };
  await supabaseAdmin.from("scrape_job_cities").delete().in("job_id", ids);
  await supabaseAdmin.from("scrape_jobs").delete().in("id", ids);
  await safeWrite("audit_log:delete_empty_jobs", supabaseAdmin.from("audit_log").insert({
    action: "delete_empty_jobs",
    details: { count: ids.length },
  }));
  return { removed: ids.length };
});

export const deleteJob = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("scrape_results").delete().eq("job_id", data.jobId);
    await supabaseAdmin.from("scrape_job_cities").delete().eq("job_id", data.jobId);
    await supabaseAdmin.from("scrape_jobs").delete().eq("id", data.jobId);
    await safeWrite("audit_log:delete_job", supabaseAdmin.from("audit_log").insert({
      action: "delete_job",
      details: { jobId: data.jobId },
    }));
    return { ok: true };
  });
