// Server functions لإدارة مكتبة الوظائف السابقة
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("scrape_jobs")
    .select("id, country, activity, status, results_count, cities_done, cities_total, created_at, error_message")
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
    if (from > 50_000) break;
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

export const runDedup = createServerFn({ method: "POST" })
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { dedupJob } = await import("@/lib/scrape-engine.server");
    return dedupJob(data.jobId);
  });
