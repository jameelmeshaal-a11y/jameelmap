// مسار عام لإعادة إثراء وظيفة سابقة (استخراج إيميلات/سوشيال للصفوف الموجودة)
import { createFileRoute } from "@tanstack/react-router";
import { reEnrichJob } from "@/lib/scrape-engine.server";

export const Route = createFileRoute("/api/public/reenrich/$jobId")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const jobId = params.jobId;
        if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
          return new Response("Invalid job id", { status: 400 });
        }
        try {
          const r = await reEnrichJob(jobId);
          return Response.json(r);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
