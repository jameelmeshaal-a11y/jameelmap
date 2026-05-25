// منطق جمع البيانات من Google Places API (New) عبر بوابة موصل Lovable
// يعمل على Cloudflare Worker بدون أي تبعيات Node-only

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCities } from "@/lib/country-cities";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

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
  if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured — please connect Google Maps Platform");

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
    throw new Error(`Places searchText failed [${res.status}]: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { places?: Array<Record<string, unknown>>; nextPageToken?: string };
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

async function searchCity(activity: string, city: string): Promise<PlaceResult[]> {
  const query = `${activity} in ${city}`;
  const out: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const { places, nextPageToken } = await searchTextOnce(query, pageToken);
    for (const p of places) {
      const id = (p.id as string) ?? "";
      if (!id) continue;
      const phone = cleanPhone((p.internationalPhoneNumber as string) || (p.nationalPhoneNumber as string) || "");
      out.push({
        place_id: id,
        name: ((p.displayName as { text?: string } | undefined)?.text) ?? "",
        address: (p.formattedAddress as string) ?? "",
        state: extractState(p.addressComponents as Array<{ types: string[]; shortText?: string; longText?: string }>),
        phone,
        whatsapp: phone && /^\+\d{10,15}$/.test(phone) ? phone : "",
        website: (p.websiteUri as string) ?? "",
        category: ((p.primaryTypeDisplayName as { text?: string } | undefined)?.text) ?? "",
        maps_url: (p.googleMapsUri as string) ?? "",
      });
    }
    if (!nextPageToken) break;
    pageToken = nextPageToken;
    // Google requires small delay before pageToken becomes active
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

export async function runScrapeJob(jobId: string, country: string, activity: string): Promise<void> {
  // فحص مسبق للمفاتيح — لا فائدة من الاستمرار بدونها
  if (!process.env.LOVABLE_API_KEY || !process.env.GOOGLE_MAPS_API_KEY) {
    const missing = [
      !process.env.LOVABLE_API_KEY && "LOVABLE_API_KEY",
      !process.env.GOOGLE_MAPS_API_KEY && "GOOGLE_MAPS_API_KEY",
    ].filter(Boolean).join(", ");
    await supabaseAdmin
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: `موصل Google Maps Platform غير مربوط بالمشروع. مفاتيح ناقصة: ${missing}. يجب ربط الموصل من إعدادات المشروع.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }

  const { cities } = resolveCities(country);

  await supabaseAdmin
    .from("scrape_jobs")
    .update({ status: "running", cities_total: cities.length, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  const seen = new Set<string>();
  let totalSaved = 0;
  let failedCities = 0;
  let lastError = "";

  try {
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      await supabaseAdmin
        .from("scrape_jobs")
        .update({ current_city: city, cities_done: i, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      let cityResults: PlaceResult[] = [];
      try {
        cityResults = await searchCity(activity, city);
      } catch (err) {
        failedCities++;
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`City failed: ${city}`, err);
        continue;
      }

      const fresh = cityResults.filter((r) => !seen.has(r.place_id));
      fresh.forEach((r) => seen.add(r.place_id));

      if (fresh.length > 0) {
        const rows = fresh.map((r) => ({
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
        }));
        const { error } = await supabaseAdmin
          .from("scrape_results")
          .upsert(rows, { onConflict: "job_id,place_id", ignoreDuplicates: true });
        if (error) console.error("Insert error:", error);
        else totalSaved += rows.length;
      }

      await supabaseAdmin
        .from("scrape_jobs")
        .update({
          cities_done: i + 1,
          results_count: totalSaved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    // لو فشلت كل المدن أو معظمها — لا تخفِ المشكلة
    const allFailed = failedCities === cities.length;
    const mostlyFailed = failedCities > 0 && totalSaved === 0;

    if (allFailed || mostlyFailed) {
      await supabaseAdmin
        .from("scrape_jobs")
        .update({
          status: "failed",
          current_city: "",
          error_message: `فشلت ${failedCities} من ${cities.length} مدينة. آخر خطأ: ${lastError || "غير معروف"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return;
    }

    await supabaseAdmin
      .from("scrape_jobs")
      .update({
        status: "completed",
        current_city: "",
        cities_done: cities.length,
        results_count: totalSaved,
        error_message: failedCities > 0 ? `تنبيه: فشلت ${failedCities} مدينة` : "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("scrape_jobs")
      .update({ status: "failed", error_message: msg, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    throw err;
  }
}
