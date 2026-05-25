// مسار عام لتنزيل Excel — /api/public/ لتجاوز حماية صفحة الدخول على النطاق المنشور
import { createFileRoute } from "@tanstack/react-router";
import ExcelJS from "exceljs";
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
          .select("name, address, city, state, phone, email, whatsapp, website, facebook, instagram, twitter, youtube, tiktok, snapchat, category, maps_url")
          .eq("job_id", jobId)
          .order("city", { ascending: true });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "عالم جميل";
        workbook.created = new Date();

        const sheetName = `${job.activity}`.slice(0, 28) || "النتائج";
        const ws = workbook.addWorksheet(sheetName, {
          views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
        });

        ws.columns = [
          { header: "المدينة", key: "city", width: 18 },
          { header: "اسم المكان", key: "name", width: 36 },
          { header: "العنوان", key: "address", width: 50 },
          { header: "الولاية/المنطقة", key: "state", width: 16 },
          { header: "الجوال", key: "phone", width: 18 },
          { header: "الإيميل", key: "email", width: 28 },
          { header: "واتساب", key: "whatsapp", width: 18 },
          { header: "الموقع الإلكتروني", key: "website", width: 32 },
          { header: "فيسبوك", key: "facebook", width: 28 },
          { header: "إنستقرام", key: "instagram", width: 28 },
          { header: "تويتر / X", key: "twitter", width: 28 },
          { header: "يوتيوب", key: "youtube", width: 28 },
          { header: "تيك توك", key: "tiktok", width: 28 },
          { header: "سناب شات", key: "snapchat", width: 24 },
          { header: "التصنيف", key: "category", width: 22 },
          { header: "خرائط جوجل", key: "maps_url", width: 36 },
        ];

        const header = ws.getRow(1);
        header.height = 28;
        header.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B6B3A" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            left: { style: "thin", color: { argb: "FFCCCCCC" } },
            right: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
          };
        });

        // الأعمدة التي محتواها لاتيني (محاذاة يسار)
        const ltrCols = new Set(["email", "website", "facebook", "instagram", "twitter", "youtube", "tiktok", "snapchat", "maps_url"]);
        const centerCols = new Set(["phone", "whatsapp"]);

        (rows ?? []).forEach((r, idx) => {
          const row = ws.addRow(r);
          const fill = idx % 2 === 0
            ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEAF4EE" } }
            : undefined;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: "Calibri", size: 10 };
            cell.border = {
              top: { style: "hair", color: { argb: "FFDDDDDD" } },
              left: { style: "hair", color: { argb: "FFDDDDDD" } },
              right: { style: "hair", color: { argb: "FFDDDDDD" } },
              bottom: { style: "hair", color: { argb: "FFDDDDDD" } },
            };
            if (fill) cell.fill = fill;
            const colKey = (ws.columns[colNumber - 1]?.key ?? "") as string;
            if (ltrCols.has(colKey)) {
              cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            } else if (centerCols.has(colKey)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
            }
          });
        });

        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `aalam-jameel-${job.country}-${job.activity}-${Date.now()}.xlsx`
          .replace(/[^a-zA-Z0-9._-]+/g, "_");

        return new Response(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
