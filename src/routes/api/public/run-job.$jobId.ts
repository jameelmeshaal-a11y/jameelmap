// مسار يشغّل المهمة فعلياً — يبقى المتصفح متصلاً به حتى الانتهاء (يحافظ على عمل Worker)
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScrapeJob } from "@/lib/scrape-engine.server";

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
          .select("country, activity, status")
          .eq("id", jobId)
          .single();

        if (!job) return new Response("Not found", { status: 404 });
        if (job.status !== "pending") {
          return Response.json({ alreadyStarted: true, status: job.status });
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
