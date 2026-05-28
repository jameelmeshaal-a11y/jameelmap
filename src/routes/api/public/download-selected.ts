// تصدير محدد — يدمج نتائج عمليات بحث مختارة في ملف Excel واحد
// مع dedup بأولوية: place_id ثم (phone + maps_url)، والاحتفاظ بالأغنى بيانات
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_ROWS = 50_000;

interface Row {
  place_id?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  maps_url?: string;
  [k: string]: unknown;
}

function richness(r: Row): number {
  const fields = ["name","address","city","state","country","phone","email","website","maps_url","whatsapp","facebook","instagram","twitter","youtube","tiktok","snapchat","all_emails","category"];
  let n = 0;
  for (const f of fields) {
    const v = (r as Record<string, unknown>)[f];
    if (typeof v === "string" && v.trim() !== "") n++;
    else if (v !== null && v !== undefined && typeof v !== "string") n++;
  }
  return n;
}

function pickRicher(a: Row, b: Row): Row {
  return richness(b) > richness(a) ? b : a;
}

export const Route = createFileRoute("/api/public/download-selected")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const idsRaw = url.searchParams.get("ids") || "";
          const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);

          const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(ids);
          if (!parsed.success) {
            return new Response("Invalid ids parameter", { status: 400 });
          }
          const jobIds = parsed.data;

          // 1) قراءة كل النتائج للعمليات المحددة على دفعات
          const all: Row[] = [];
          let from = 0;
          const PAGE = 1000;
          for (;;) {
            const { data, error } = await supabaseAdmin
              .from("scrape_results")
              .select("place_id, name, address, city, state, country, phone, whatsapp, email, all_emails, website, facebook, instagram, twitter, youtube, tiktok, snapchat, category, maps_url")
              .in("job_id", jobIds)
              .order("created_at", { ascending: false })
              .range(from, from + PAGE - 1);
            if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
            if (!data || data.length === 0) break;
            all.push(...(data as Row[]));
            if (data.length < PAGE) break;
            from += PAGE;
            if (from >= MAX_ROWS) break;
          }

          // 2) Dedup الجولة 1 — place_id
          const byPid = new Map<string, Row>();
          const noPid: Row[] = [];
          for (const r of all) {
            const pid = (r.place_id || "").trim();
            if (!pid) { noPid.push(r); continue; }
            const cur = byPid.get(pid);
            byPid.set(pid, cur ? pickRicher(cur, r) : r);
          }
          const afterPid: Row[] = [...byPid.values(), ...noPid];

          // 3) Dedup الجولة 2 — phone + maps_url (كلاهما غير فارغ)
          const byPM = new Map<string, Row>();
          const noKey: Row[] = [];
          for (const r of afterPid) {
            const phone = (r.phone || "").trim();
            const mu = (r.maps_url || "").trim();
            if (!phone || !mu) { noKey.push(r); continue; }
            const k = `${phone}|${mu}`;
            const cur = byPM.get(k);
            byPM.set(k, cur ? pickRicher(cur, r) : r);
          }
          const unique: Row[] = [...byPM.values(), ...noKey];

          // 4) بناء ملف Excel — نفس أعمدة download-all
          const headers = [
            "الاسم", "المدينة", "الولاية/المنطقة", "الدولة",
            "الجوال", "الإيميل", "الموقع الإلكتروني", "خرائط جوجل",
          ];
          const data: (string | number)[][] = [headers];
          for (const r of unique) {
            data.push([
              r.name ?? "", r.city ?? "", r.state ?? "", r.country ?? "",
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
          XLSX.utils.book_append_sheet(wb, ws, "المحدد");

          const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
          const fileName = `jameel-map-selected-${Date.now()}.xlsx`;

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
          console.error("[download-selected] failed:", msg);
          return new Response(`Selected download failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
