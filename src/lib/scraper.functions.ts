// Server functions — يستدعيها العميل
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StartInput = z.object({
  country: z.string().trim().min(1).max(100),
  activity: z.string().trim().min(1).max(100),
  cities: z.array(z.string().trim().min(1).max(100)).min(1).max(200).optional(),
});

export const startScrape = createServerFn({ method: "POST" })
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job, error } = await supabaseAdmin
      .from("scrape_jobs")
      .insert({ country: data.country, activity: data.activity, status: "pending" })
      .select("id")
      .single();

    if (error || !job) throw new Error(`Failed to create job: ${error?.message}`);

    // إن وُجدت قائمة مدن مخصّصة — أنشئ صفوف per-city مبدئية واحفظها في error_message كـ JSON صغير
    // لتقرأها دالة التشغيل. نفضّل التخزين في scrape_job_cities مباشرة:
    if (data.cities && data.cities.length > 0) {
      const rows = data.cities.map((c) => ({ job_id: job.id as string, city: c, status: "pending" }));
      await supabaseAdmin.from("scrape_job_cities").insert(rows);
      await supabaseAdmin
        .from("scrape_jobs")
        .update({ cities_total: data.cities.length })
        .eq("id", job.id as string);
    }

    return { jobId: job.id as string };
  });

export const getJobStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job } = await supabaseAdmin
      .from("scrape_jobs")
      .select("*")
      .eq("id", data.jobId)
      .single();

    if (!job) throw new Error("Job not found");

    const [{ data: results }, { data: perCity }] = await Promise.all([
      supabaseAdmin
        .from("scrape_results")
        .select("name, city, state, phone, website")
        .eq("job_id", data.jobId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("scrape_job_cities")
        .select("city, status, progress, results_count, current_step, error_message")
        .eq("job_id", data.jobId)
        .order("city", { ascending: true }),
    ]);

    return {
      status: job.status as string,
      currentCity: (job.current_city as string) ?? "",
      citiesDone: job.cities_done as number,
      citiesTotal: job.cities_total as number,
      resultsCount: job.results_count as number,
      errorMessage: (job.error_message as string) ?? "",
      preview: results ?? [],
      cities: (perCity ?? []) as Array<{
        city: string;
        status: string;
        progress: number;
        results_count: number;
        current_step: string;
        error_message: string;
      }>,
    };
  });
