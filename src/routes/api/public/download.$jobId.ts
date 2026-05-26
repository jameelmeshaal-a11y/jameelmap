// تنزيل Excel — 8 أعمدة فقط
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/download/$jobId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const jobId = params.jobId;
          if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
            return new Response("Invalid job id", { status: 400 });
          }

          const { data: job, error: jobErr } = await supabaseAdmin
            .from("scrape_jobs")
            .select("country, activity, status")
            .eq("id", jobId)
            .maybeSingle();

          if (jobErr) return new Response(`DB error: ${jobErr.message}`, { status: 500 });
          if (!job) return new Response("Job not found", { status: 404 });

          const { data: rows } = await supabaseAdmin
            .from("scrape_results")
            .select("name, city, state, phone, whatsapp, website, email, maps_url")
            .eq("job_id", jobId)
            .order("city", { ascending: true });

          const headers = [
            "الاسم", "المدينة", "الولاية/المنطقة", "الجوال",
            "واتساب", "الموقع الإلكتروني", "الإيميل", "خرائط جوجل",
          ];

          const data: (string | number)[][] = [headers];
          for (const r of rows ?? []) {
            data.push([
              r.name ?? "", r.city ?? "", r.state ?? "", r.phone ?? "",
              r.whatsapp ?? "", r.website ?? "", r.email ?? "", r.maps_url ?? "",
            ]);
          }

          const ws = XLSX.utils.aoa_to_sheet(data);
          ws["!cols"] = [
            { wch: 36 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
            { wch: 18 }, { wch: 32 }, { wch: 28 }, { wch: 36 },
          ];
          (ws as unknown as { "!view"?: unknown })["!view"] = { RTL: true };
          ws["!autofilter"] = { ref: `A1:H${data.length}` };

          const wb = XLSX.utils.book_new();
          const sheetName = (job.activity || "النتائج").slice(0, 28);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);

          const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

          const fileName = `jameel-map-${job.country}-${job.activity}-${Date.now()}.xlsx`
            .replace(/[^a-zA-Z0-9._-]+/g, "_");

          return new Response(buffer, {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${fileName}"`,
              "Content-Length": String(buffer.byteLength),
              "Cache-Control": "no-store",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[download] failed:", msg);
          return new Response(`Download failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
