// منطق جمع البيانات من Google Places API (New) عبر بوابة موصل Lovable
// + إثراء بإيميل وروابط سوشيال عبر Firecrawl

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCities, MOSQUE_KEYWORDS, isMosqueActivity } from "@/lib/country-cities";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const MAX_RESULTS = 10000;
const QUERY_CONCURRENCY = 3;
const ENRICH_CONCURRENCY = 5;

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

interface EnrichmentResult {
  email: string;
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  tiktok: string;
  snapchat: string;
}

const EMPTY_ENRICHMENT: EnrichmentResult = {
  email: "", facebook: "", instagram: "", twitter: "", youtube: "", tiktok: "", snapchat: "",
};

function cleanPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
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

// تشغيل promises على دفعات بحجم معيّن
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(worker));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
    }
  }
  return results;
}

// ========== Firecrawl Enrichment ==========

const SOCIAL_PATTERNS: Array<{ key: keyof EnrichmentResult; re: RegExp }> = [
  { key: "facebook",  re: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/i },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/i },
  { key: "twitter",   re: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_.\-/]+/i },
  { key: "youtube",   re: /https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)[A-Za-z0-9_.\-/]+/i },
  { key: "tiktok",    re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-/]+/i },
  { key: "snapchat",  re: /https?:\/\/(?:www\.)?snapchat\.com\/add\/[A-Za-z0-9_.\-/]+/i },
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_BLACKLIST = /\.(png|jpg|jpeg|webp|gif|svg|css|js)$|wixpress|sentry|wordpress|example\.com|@2x|domain\.com/i;

async function enrichFromWebsite(url: string): Promise<EnrichmentResult> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY || !url) return EMPTY_ENRICHMENT;

  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: false,
      }),
    });

    if (!res.ok) return EMPTY_ENRICHMENT;
    const data = await res.json() as {
      data?: { markdown?: string; links?: string[] };
      markdown?: string;
      links?: string[];
    };
    const markdown = data.data?.markdown ?? data.markdown ?? "";
    const links = data.data?.links ?? data.links ?? [];
    const haystack = markdown + "\n" + links.join("\n");

    const result: EnrichmentResult = { ...EMPTY_ENRICHMENT };

    // إيميل: أول إيميل صالح بعد فلترة المعروف غير المفيد
    const emails = haystack.match(EMAIL_RE) ?? [];
    const goodEmail = emails.find((e) => !EMAIL_BLACKLIST.test(e));
    if (goodEmail) result.email = goodEmail.toLowerCase();

    // سوشيال: أول رابط مطابق لكل منصة
    for (const { key, re } of SOCIAL_PATTERNS) {
      const m = haystack.match(re);
      if (m) result[key] = m[0].replace(/[)\].,;]+$/, "");
    }

    return result;
  } catch {
    return EMPTY_ENRICHMENT;
  }
}

// ========== Main job ==========

export async function runScrapeJob(jobId: string, country: string, activity: string): Promise<void> {
  // فحص مسبق للمفاتيح
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
  const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;

  await supabaseAdmin.from("scrape_jobs").update({
    status: "running",
    cities_total: cities.length,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  const seen = new Set<string>();
  const enrichedIds = new Set<string>();
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

      // كل كلمات البحث لهذه المدينة بالتوازي (3 معاً)
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

      const fresh = allResults.filter((r) => !seen.has(r.place_id));
      fresh.forEach((r) => seen.add(r.place_id));
      if (fresh.length === 0) {
        await supabaseAdmin.from("scrape_jobs").update({
          cities_done: i + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        continue;
      }

      // إثراء النتائج التي لها موقع بالتوازي
      const enrichments = new Map<string, EnrichmentResult>();
      if (hasFirecrawl) {
        const toEnrich = fresh.filter((r) => r.website && !enrichedIds.has(r.place_id));
        const enrichResults = await runInBatches(toEnrich, ENRICH_CONCURRENCY, async (r) => {
          const e = await enrichFromWebsite(r.website);
          enrichedIds.add(r.place_id);
          return [r.place_id, e] as const;
        });
        for (const [pid, e] of enrichResults) enrichments.set(pid, e);
      }

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
          whatsapp: r.whatsapp,
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
