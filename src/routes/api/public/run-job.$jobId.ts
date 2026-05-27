// مسار يشغّل المهمة فعلياً — يبقى المتصفح متصلاً به حتى الانتهاء (يحافظ على عمل Worker)
// يقبل: pending (بدء جديد) أو stopped/failed (استئناف) أو running متعلّقة (>3 دقائق).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScrapeJob } from "@/lib/scrape-engine.server";

const STUCK_MS = 3 * 60 * 1000;

export const Route = createFileRoute("/api/public/run-job/$jobId")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const jobId = params.jobId;
        if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
          return new Response("Invalid job id", { status: 400 });
        }

        const { data: job } = await supabaseAdmin
          .from("scrape_jobs")
          .select("country, activity, status, updated_at")
          .eq("id", jobId)
          .single();

        if (!job) return new Response("Not found", { status: 404 });

        const updatedAt = job.updated_at ? new Date(job.updated_at as string).getTime() : 0;
        const isStuck = Date.now() - updatedAt > STUCK_MS;
        const canRun =
          job.status === "pending" ||
          job.status === "stopped" ||
          job.status === "failed" ||
          (job.status === "running" && isStuck);

        if (!canRun) {
          return Response.json({ alreadyStarted: true, status: job.status });
        }

        // أعِد فتح المهمة إن كانت موقوفة/فاشلة/متعلقة
        if (job.status !== "pending") {
          await supabaseAdmin
            .from("scrape_jobs")
            .update({ status: "pending", stopped_at: null, updated_at: new Date().toISOString() })
            .eq("id", jobId);
          await supabaseAdmin
            .from("scrape_job_cities")
            .update({ status: "pending", current_step: "استئناف", updated_at: new Date().toISOString() })
            .eq("job_id", jobId)
            .in("status", ["running", "failed"]);
        }

        try {
          await runScrapeJob(jobId, job.country as string, job.activity as string);
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
