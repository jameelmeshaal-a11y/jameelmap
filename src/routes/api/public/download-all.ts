// تصدير مجمّع — كل النتائج من كل العمليات بدون تكرار
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const Route = createFileRoute("/api/public/download-all")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // اقرأ على دفعات (Supabase حد 1000 افتراضي)
          const all: Array<Record<string, unknown>> = [];
          let from = 0;
          const PAGE = 1000;
          for (;;) {
            const { data, error } = await supabaseAdmin
              .from("scrape_results")
              .select("place_id, name, city, state, country, phone, email, website, maps_url")
              .order("created_at", { ascending: false })
              .range(from, from + PAGE - 1);
            if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
            if (!data || data.length === 0) break;
            all.push(...data);
            if (data.length < PAGE) break;
            from += PAGE;
            if (from > 50_000) break; // حد أمان
          }

          // dedup بـ place_id ثم (name+city) ثم phone
          const seenPid = new Set<string>();
          const seenKey = new Set<string>();
          const unique: Array<Record<string, unknown>> = [];
          for (const r of all) {
            const pid = (r.place_id as string) || "";
            if (pid) {
              if (seenPid.has(pid)) continue;
              seenPid.add(pid);
            }
            const nk = `n:${normalizeName(r.name as string)}|${((r.city as string) || "").toLowerCase()}`;
            const pk = r.phone ? `p:${r.phone}` : "";
            if (seenKey.has(nk)) continue;
            if (pk && seenKey.has(pk)) continue;
            seenKey.add(nk);
            if (pk) seenKey.add(pk);
            unique.push(r);
          }

          const headers = [
            "الاسم", "المدينة", "الولاية/المنطقة", "الدولة",
            "الجوال", "الإيميل", "الموقع الإلكتروني", "خرائط جوجل",
          ];
          const data: (string | number)[][] = [headers];
          for (const r of unique) {
            data.push([
              (r.name as string) ?? "", (r.city as string) ?? "", (r.state as string) ?? "",
              (r.country as string) ?? "", (r.phone as string) ?? "",
              (r.email as string) ?? "", (r.website as string) ?? "", (r.maps_url as string) ?? "",
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
          XLSX.utils.book_append_sheet(wb, ws, "كل النتائج");

          const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
          const fileName = `jameel-map-aggregate-${Date.now()}.xlsx`;

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
          console.error("[download-all] failed:", msg);
          return new Response(`Aggregate download failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
