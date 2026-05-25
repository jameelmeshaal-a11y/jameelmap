// Server functions — يستدعيها العميل
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StartInput = z.object({
  country: z.string().trim().min(1).max(100),
  activity: z.string().trim().min(1).max(100),
});

export const startScrape = createServerFn({ method: "POST" })
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runScrapeJob } = await import("@/lib/scrape-engine.server");

    const { data: job, error } = await supabaseAdmin
      .from("scrape_jobs")
      .insert({ country: data.country, activity: data.activity, status: "pending" })
      .select("id")
      .single();

    if (error || !job) throw new Error(`Failed to create job: ${error?.message}`);

    // إطلاق المهمة في الخلفية (Cloudflare Workers يدعم async بدون await)
    // لكن لضمان التنفيذ، نستخدم waitUntil-style: نطلقها ولا ننتظر
    runScrapeJob(job.id, data.country, data.activity).catch((e) => {
      console.error("Background job failed:", e);
    });

    return { jobId: job.id };
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

    const { data: results } = await supabaseAdmin
      .from("scrape_results")
      .select("name, city, state, phone, website")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      status: job.status as string,
      currentCity: (job.current_city as string) ?? "",
      citiesDone: job.cities_done as number,
      citiesTotal: job.cities_total as number,
      resultsCount: job.results_count as number,
      errorMessage: (job.error_message as string) ?? "",
      preview: results ?? [],
    };
  });
