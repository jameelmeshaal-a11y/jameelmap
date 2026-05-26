// منطق جمع البيانات من Google Places API (New) عبر بوابة موصل Lovable
// + إثراء بإيميل وروابط سوشيال (Firecrawl ⇒ HTML fallback)

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCities, MOSQUE_KEYWORDS, isMosqueActivity } from "@/lib/country-cities";
import { enrichFromWebsite, runInBatches, normalizeName, EMPTY_ENRICHMENT } from "@/lib/enrich.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const MAX_RESULTS = 10000;
const QUERY_CONCURRENCY = 3;
const ENRICH_CONCURRENCY = 4;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.addressComponents",
  "nextPageToken",
].join(",");

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  state: string;
  phone: string;
  whatsapp: string;
  website: string;
  category: string;
  maps_url: string;
}

function cleanPhone(phone: string): string {
  return phone ? phone.replace(/[^\d+]/g, "") : "";
}

function extractState(components: Array<{ types: string[]; shortText?: string; longText?: string }> | undefined): string {
  if (!components) return "";
  const admin = components.find((c) => c.types?.includes("administrative_area_level_1"));
  return admin?.shortText || admin?.longText || "";
}

async function searchTextOnce(query: string, pageToken?: string): Promise<{
  places: Array<Record<string, unknown>>;
  nextPageToken?: string;
}> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

  const body: Record<string, unknown> = { textQuery: query, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places searchText failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { places?: Array<Record<string, unknown>>; nextPageToken?: string };
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

function placeToResult(p: Record<string, unknown>): PlaceResult | null {
  const id = (p.id as string) ?? "";
  if (!id) return null;
  const phone = cleanPhone((p.internationalPhoneNumber as string) || (p.nationalPhoneNumber as string) || "");
  return {
    place_id: id,
    name: ((p.displayName as { text?: string } | undefined)?.text) ?? "",
    address: (p.formattedAddress as string) ?? "",
    state: extractState(p.addressComponents as Array<{ types: string[]; shortText?: string; longText?: string }>),
    phone,
    whatsapp: phone && /^\+\d{10,15}$/.test(phone) ? phone : "",
    website: (p.websiteUri as string) ?? "",
    category: ((p.primaryTypeDisplayName as { text?: string } | undefined)?.text) ?? "",
    maps_url: (p.googleMapsUri as string) ?? "",
  };
}

async function searchQuery(query: string): Promise<PlaceResult[]> {
  const out: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const { places, nextPageToken } = await searchTextOnce(query, pageToken);
    for (const p of places) {
      const r = placeToResult(p);
      if (r) out.push(r);
    }
    if (!nextPageToken) break;
    pageToken = nextPageToken;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

// ========== Main job ==========

export async function runScrapeJob(jobId: string, country: string, activity: string): Promise<void> {
  if (!process.env.LOVABLE_API_KEY || !process.env.GOOGLE_MAPS_API_KEY) {
    const missing = [
      !process.env.LOVABLE_API_KEY && "LOVABLE_API_KEY",
      !process.env.GOOGLE_MAPS_API_KEY && "GOOGLE_MAPS_API_KEY",
    ].filter(Boolean).join(", ");
    await supabaseAdmin.from("scrape_jobs").update({
      status: "failed",
      error_message: `موصل Google Maps غير مربوط. مفاتيح ناقصة: ${missing}.`,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return;
  }

  const { cities } = resolveCities(country);
  const isMosque = isMosqueActivity(activity);
  const keywords = isMosque ? MOSQUE_KEYWORDS : [activity];

  await supabaseAdmin.from("scrape_jobs").update({
    status: "running",
    cities_total: cities.length,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  const seenPlaceIds = new Set<string>();
  const seenDedupKeys = new Set<string>(); // مفتاح: name+city أو phone
  let totalSaved = 0;
  let failedCities = 0;
  let lastError = "";

  try {
    for (let i = 0; i < cities.length; i++) {
      if (totalSaved >= MAX_RESULTS) break;
      const city = cities[i];

      await supabaseAdmin.from("scrape_jobs").update({
        current_city: city,
        cities_done: i,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      const queries = keywords.map((kw) => `${kw} in ${city}`);
      const allResults: PlaceResult[] = [];
      const errors: string[] = [];

      for (let b = 0; b < queries.length; b += QUERY_CONCURRENCY) {
        const batch = queries.slice(b, b + QUERY_CONCURRENCY);
        const settled = await Promise.allSettled(batch.map(searchQuery));
        for (const s of settled) {
          if (s.status === "fulfilled") allResults.push(...s.value);
          else errors.push(s.reason instanceof Error ? s.reason.message : String(s.reason));
        }
      }

      if (errors.length === queries.length) {
        failedCities++;
        lastError = errors[errors.length - 1] ?? "unknown";
        console.error(`City fully failed: ${city}`, errors[0]);
        continue;
      }

      // إزالة التكرار: place_id (Google) + (الاسم المُطبَّع + المدينة) + الهاتف
      const fresh: PlaceResult[] = [];
      for (const r of allResults) {
        if (seenPlaceIds.has(r.place_id)) continue;
        const nameKey = `n:${normalizeName(r.name)}|${city.toLowerCase()}`;
        const phoneKey = r.phone ? `p:${r.phone}` : "";
        if (seenDedupKeys.has(nameKey)) continue;
        if (phoneKey && seenDedupKeys.has(phoneKey)) continue;
        seenPlaceIds.add(r.place_id);
        seenDedupKeys.add(nameKey);
        if (phoneKey) seenDedupKeys.add(phoneKey);
        fresh.push(r);
      }

      if (fresh.length === 0) {
        await supabaseAdmin.from("scrape_jobs").update({
          cities_done: i + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        continue;
      }

      // إثراء (Firecrawl ⇒ HTML fallback) — للنتائج التي لها موقع
      const toEnrich = fresh.filter((r) => r.website);
      const enrichResults = await runInBatches(toEnrich, ENRICH_CONCURRENCY, async (r) => {
        const e = await enrichFromWebsite(r.website, r.phone);
        return [r.place_id, e] as const;
      });
      const enrichments = new Map(enrichResults);

      const rows = fresh.map((r) => {
        const e = enrichments.get(r.place_id) ?? EMPTY_ENRICHMENT;
        return {
          job_id: jobId,
          place_id: r.place_id,
          name: r.name,
          address: r.address,
          city,
          state: r.state,
          phone: r.phone,
          whatsapp: e.whatsapp || r.whatsapp,
          website: r.website,
          category: r.category,
          maps_url: r.maps_url,
          email: e.email,
          facebook: e.facebook,
          instagram: e.instagram,
          twitter: e.twitter,
          youtube: e.youtube,
          tiktok: e.tiktok,
          snapchat: e.snapchat,
        };
      });

      const { error } = await supabaseAdmin
        .from("scrape_results")
        .upsert(rows, { onConflict: "job_id,place_id", ignoreDuplicates: true });
      if (error) console.error("Insert error:", error);
      else totalSaved += rows.length;

      await supabaseAdmin.from("scrape_jobs").update({
        cities_done: i + 1,
        results_count: totalSaved,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    const allFailed = failedCities === cities.length;
    const mostlyFailed = failedCities > 0 && totalSaved === 0;
    if (allFailed || mostlyFailed) {
      await supabaseAdmin.from("scrape_jobs").update({
        status: "failed",
        current_city: "",
        error_message: `فشلت ${failedCities} من ${cities.length} مدينة. آخر خطأ: ${lastError || "غير معروف"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    await supabaseAdmin.from("scrape_jobs").update({
      status: "completed",
      current_city: "",
      cities_done: cities.length,
      results_count: totalSaved,
      error_message: failedCities > 0 ? `تنبيه: فشلت ${failedCities} مدينة` : "",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("scrape_jobs").update({
      status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    throw err;
  }
}

// ============================================================
// إعادة إثراء وظيفة موجودة (استخراج إيميل/سوشيال بدون إعادة جمع)
// ============================================================

export async function reEnrichJob(jobId: string): Promise<{ updated: number; total: number }> {
  // اقرأ الصفوف التي لديها موقع ولا تملك إيميل بعد
  const { data: rows } = await supabaseAdmin
    .from("scrape_results")
    .select("id, website, phone, email")
    .eq("job_id", jobId)
    .neq("website", "")
    .limit(5000);

  if (!rows || rows.length === 0) return { updated: 0, total: 0 };

  const targets = rows.filter((r) => !r.email);
  let updated = 0;

  await runInBatches(targets, ENRICH_CONCURRENCY, async (row) => {
    const e = await enrichFromWebsite(row.website as string, (row.phone as string) ?? "");
    if (!e.email && !e.facebook && !e.instagram && !e.whatsapp) return;
    const patch: Record<string, string> = {};
    if (e.email) patch.email = e.email;
    if (e.facebook) patch.facebook = e.facebook;
    if (e.instagram) patch.instagram = e.instagram;
    if (e.twitter) patch.twitter = e.twitter;
    if (e.youtube) patch.youtube = e.youtube;
    if (e.tiktok) patch.tiktok = e.tiktok;
    if (e.snapchat) patch.snapchat = e.snapchat;
    if (e.whatsapp) patch.whatsapp = e.whatsapp;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("scrape_results").update(patch).eq("id", row.id as string);
      if (!error) updated++;
    }
  });

  return { updated, total: targets.length };
}

// ============================================================
// إزالة التكرار من وظيفة موجودة (اسم مُطبَّع+مدينة، أو هاتف)
// ============================================================

export async function dedupJob(jobId: string): Promise<{ removed: number; kept: number }> {
  const { data: rows } = await supabaseAdmin
    .from("scrape_results")
    .select("id, name, city, phone, email, website, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(10000);

  if (!rows || rows.length === 0) return { removed: 0, kept: 0 };

  // نحتفظ بالصف الأغنى بالبيانات لكل مفتاح
  const score = (r: { email?: string | null; website?: string | null; phone?: string | null }) =>
    (r.email ? 2 : 0) + (r.website ? 1 : 0) + (r.phone ? 1 : 0);

  const byKey = new Map<string, { id: string; score: number }>();
  const toDelete: string[] = [];

  for (const r of rows) {
    const keys: string[] = [];
    const nameKey = `n:${normalizeName((r.name as string) ?? "")}|${((r.city as string) ?? "").toLowerCase()}`;
    keys.push(nameKey);
    if (r.phone) keys.push(`p:${r.phone}`);
    const myScore = score(r);
    let dup = false;
    for (const k of keys) {
      const existing = byKey.get(k);
      if (existing) {
        dup = true;
        if (myScore > existing.score) {
          toDelete.push(existing.id);
          byKey.set(k, { id: r.id as string, score: myScore });
        } else {
          toDelete.push(r.id as string);
        }
        break;
      }
    }
    if (!dup) {
      for (const k of keys) byKey.set(k, { id: r.id as string, score: myScore });
    }
  }

  // حذف على دفعات
  const unique = [...new Set(toDelete)];
  for (let i = 0; i < unique.length; i += 200) {
    const batch = unique.slice(i, i + 200);
    await supabaseAdmin.from("scrape_results").delete().in("id", batch);
  }

  const finalCount = rows.length - unique.length;
  await supabaseAdmin.from("scrape_jobs").update({
    results_count: finalCount,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  return { removed: unique.length, kept: finalCount };
}
