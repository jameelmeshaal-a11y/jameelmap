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

          // Pagination — Supabase يحدّ كل استعلام بـ 1000 صف افتراضياً
          const PAGE = 1000;
          const HARD_CAP = 50000;
          const rows: Array<{
            name: string | null; city: string | null; state: string | null;
            country: string | null; phone: string | null; email: string | null;
            website: string | null; maps_url: string | null;
          }> = [];
          for (let from = 0; from < HARD_CAP; from += PAGE) {
            const { data: page, error: pageErr } = await supabaseAdmin
              .from("scrape_results")
              .select("name, city, state, country, phone, email, website, maps_url")
              .eq("job_id", jobId)
              .order("city", { ascending: true })
              .range(from, from + PAGE - 1);
            if (pageErr) return new Response(`DB error: ${pageErr.message}`, { status: 500 });
            if (!page || page.length === 0) break;
            rows.push(...page);
            if (page.length < PAGE) break;
          }

          const headers = [
            "الاسم", "المدينة", "الولاية/المنطقة", "الدولة",
            "الجوال", "الإيميل", "الموقع الإلكتروني", "خرائط جوجل",
          ];

          const data: (string | number)[][] = [headers];
          for (const r of rows) {
            data.push([
              r.name ?? "", r.city ?? "", r.state ?? "", r.country ?? (job.country ?? ""),
              r.phone ?? "", r.email ?? "", r.website ?? "", r.maps_url ?? "",
            ]);
          }

          const ws = XLSX.utils.aoa_to_sheet(data);
          ws["!cols"] = [
            { wch: 36 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
            { wch: 18 }, { wch: 28 }, { wch: 32 }, { wch: 36 },
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
