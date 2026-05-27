// Server functions — يستدعيها العميل (محمية بـ Auth)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  country: z.string().trim().min(1).max(100),
  activity: z.string().trim().min(1).max(100),
  cities: z.array(z.string().trim().min(1).max(100)).min(1).max(200).optional(),
  maxResults: z.number().int().min(100).max(20000).optional(),
});

export const startScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1) فحص الصلاحيات (الإدمن يتجاوز)
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    if (!isAdmin) {
      const { data: perms } = await supabaseAdmin
        .from("user_permissions")
        .select("can_search, max_searches_per_day, allowed_countries")
        .eq("user_id", userId)
        .maybeSingle();

      if (!perms || !perms.can_search) {
        throw new Error("ليست لديك صلاحية بدء البحث. تواصل مع المشرف.");
      }

      const allowed = (perms.allowed_countries as string[]) ?? [];
      if (allowed.length > 0 && !allowed.includes(data.country)) {
        throw new Error(`الدولة "${data.country}" غير مسموحة لحسابك. المسموح: ${allowed.join(", ")}`);
      }

      // عدّاد اليوم
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("scrape_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since.toISOString());
      if ((count ?? 0) >= (perms.max_searches_per_day ?? 10)) {
        throw new Error(`تجاوزت الحد اليومي (${perms.max_searches_per_day}). جرّب غداً.`);
      }
    }

    const { data: job, error } = await supabaseAdmin
      .from("scrape_jobs")
      .insert({
        country: data.country,
        activity: data.activity,
        status: "pending",
        user_id: userId,
        max_results: data.maxResults ?? 2000,
        selected_cities: data.cities ?? [],
        total_cities: data.cities?.length ?? 0,
      })
      .select("id")
      .single();

    if (error || !job) throw new Error(`Failed to create job: ${error?.message}`);

    if (data.cities && data.cities.length > 0) {
      const rows = data.cities.map((c) => ({ job_id: job.id as string, city: c, status: "pending" }));
      await supabaseAdmin.from("scrape_job_cities").insert(rows);
      await supabaseAdmin
        .from("scrape_jobs")
        .update({ cities_total: data.cities.length })
        .eq("id", job.id as string);
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      action: "start_scrape",
      details: { jobId: job.id, country: data.country, activity: data.activity, cities: data.cities?.length ?? 0 },
    });

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

export const stopScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("scrape_jobs")
      .update({
        status: "stopped",
        stopped_at: new Date().toISOString(),
        error_message: "تم إيقاف المهمة يدوياً",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      action: "stop_scrape",
      details: { jobId: data.jobId },
    });
    return { ok: true };
  });

export const resumeScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // أعِد ضبط أي مدينة معلّقة (running منذ فترة) إلى pending
    await supabaseAdmin
      .from("scrape_job_cities")
      .update({ status: "pending", current_step: "في انتظار الاستئناف", updated_at: new Date().toISOString() })
      .eq("job_id", data.jobId)
      .in("status", ["running", "failed"]);
    await supabaseAdmin
      .from("scrape_jobs")
      .update({
        status: "pending",
        stopped_at: null,
        error_message: "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      action: "resume_scrape",
      details: { jobId: data.jobId },
    });
    // أطلق التشغيل في الخلفية
    return { ok: true, jobId: data.jobId };
  });
