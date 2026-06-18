// تقسيم شبكي تكيّفي لمدينة + بحث Places API (New) عبر بوابة Lovable
// الهدف: استخراج ~كل المتاجر بدلاً من الحد 60 نتيجة/استعلام.

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

export interface RawPlace {
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

interface Viewport {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
}

interface GeocodeResult {
  center: { lat: number; lng: number };
  viewport: Viewport;
}

function clean(phone: string): string {
  return phone ? phone.replace(/[^\d+]/g, "") : "";
}

function extractState(c: Array<{ types: string[]; shortText?: string; longText?: string }> | undefined): string {
  if (!c) return "";
  const a = c.find((x) => x.types?.includes("administrative_area_level_1"));
  return a?.shortText || a?.longText || "";
}

function mapPlace(p: Record<string, unknown>): RawPlace | null {
  const id = (p.id as string) ?? "";
  if (!id) return null;
  const phone = clean((p.internationalPhoneNumber as string) || (p.nationalPhoneNumber as string) || "");
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

function authHeaders(): Record<string, string> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps connector not configured");
  }
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
    "Content-Type": "application/json",
  };
}

// ---------------- Geocoding (via Places API New: searchText) ----------------
// نتجنّب Geocoding API القديم (محظور بحدّ معدّل 24س على بعض الموصلات)
// ونستخدم places:searchText الذي يعيد location + viewport مباشرةً.
async function searchTextOnce(city: string, country: string, languageCode: string): Promise<GeocodeResult | null> {
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "X-Goog-FieldMask": "places.location,places.viewport",
    },
    body: JSON.stringify({
      textQuery: `${city}, ${country}`,
      languageCode,
      pageSize: 1,
    }),
  });
  if (res.status === 429) {
    const err = new Error("RATE_LIMITED");
    (err as Error & { code?: string }).code = "RATE_LIMITED";
    throw err;
  }
  if (!res.ok) return null;
  const j = (await res.json()) as {
    places?: Array<{
      location?: { latitude: number; longitude: number };
      viewport?: {
        low: { latitude: number; longitude: number };
        high: { latitude: number; longitude: number };
      };
    }>;
  };
  const p = j.places?.[0];
  if (!p?.location) return null;
  const lat = p.location.latitude;
  const lng = p.location.longitude;
  if (p.viewport?.low && p.viewport?.high) {
    return {
      center: { lat, lng },
      viewport: { low: p.viewport.low, high: p.viewport.high },
    };
  }
  return {
    center: { lat, lng },
    viewport: {
      low: { latitude: lat - 0.05, longitude: lng - 0.05 },
      high: { latitude: lat + 0.05, longitude: lng + 0.05 },
    },
  };
}

export async function geocodeCity(city: string, country: string): Promise<GeocodeResult | null> {
  const tryWith = async (lang: string): Promise<{ result: GeocodeResult | null; rateLimited: boolean }> => {
    try {
      return { result: await searchTextOnce(city, country, lang), rateLimited: false };
    } catch (e) {
      if ((e as Error & { code?: string }).code === "RATE_LIMITED") {
        await new Promise((r) => setTimeout(r, 500));
        try {
          return { result: await searchTextOnce(city, country, lang), rateLimited: false };
        } catch {
          return { result: null, rateLimited: true };
        }
      }
      return { result: null, rateLimited: false };
    }
  };
  const en = await tryWith("en");
  if (en.result) return en.result;
  const ar = await tryWith("ar");
  if (ar.result) return ar.result;
  if (en.rateLimited || ar.rateLimited) {
    const err = new Error("حدّ معدّل موصل Google Maps مُستنفد. أعد المحاولة لاحقاً أو اربط مفتاح Google Maps خاص بك.");
    (err as Error & { code?: string }).code = "RATE_LIMITED";
    throw err;
  }
  return null;
}

// ---------------- Cell tiling ----------------
interface Cell {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
}

export function tileViewport(vp: Viewport, gridSize = 4): Cell[] {
  const cells: Cell[] = [];
  const latStep = (vp.high.latitude - vp.low.latitude) / gridSize;
  const lngStep = (vp.high.longitude - vp.low.longitude) / gridSize;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      cells.push({
        low: {
          latitude: vp.low.latitude + i * latStep,
          longitude: vp.low.longitude + j * lngStep,
        },
        high: {
          latitude: vp.low.latitude + (i + 1) * latStep,
          longitude: vp.low.longitude + (j + 1) * lngStep,
        },
      });
    }
  }
  return cells;
}

function splitCell(c: Cell): Cell[] {
  const midLat = (c.low.latitude + c.high.latitude) / 2;
  const midLng = (c.low.longitude + c.high.longitude) / 2;
  return [
    { low: c.low, high: { latitude: midLat, longitude: midLng } },
    { low: { latitude: c.low.latitude, longitude: midLng }, high: { latitude: midLat, longitude: c.high.longitude } },
    { low: { latitude: midLat, longitude: c.low.longitude }, high: { latitude: c.high.latitude, longitude: midLng } },
    { low: { latitude: midLat, longitude: midLng }, high: c.high },
  ];
}

// مسافة قطرية تقريبية للخلية بالأمتار (لمعرفة هل تستحق التقسيم)
function cellDiagonalMeters(c: Cell): number {
  const dLat = (c.high.latitude - c.low.latitude) * 111_000;
  const avgLat = (c.high.latitude + c.low.latitude) / 2;
  const dLng = (c.high.longitude - c.low.longitude) * 111_000 * Math.cos((avgLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// ---------------- Search ----------------
async function searchTextCell(
  textQuery: string,
  cell: Cell,
  pageToken?: string,
  retries = 2,
): Promise<{ places: Array<Record<string, unknown>>; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery,
    pageSize: 20,
    locationRestriction: { rectangle: cell },
  };
  if (pageToken) body.pageToken = pageToken;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: { ...authHeaders(), "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const j = (await res.json()) as {
        places?: Array<Record<string, unknown>>;
        nextPageToken?: string;
      };
      return { places: j.places ?? [], nextPageToken: j.nextPageToken };
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    // 4xx غير 429: لا تكرر
    return { places: [] };
  }
  return { places: [] };
}

async function searchCellAllPages(textQuery: string, cell: Cell): Promise<RawPlace[]> {
  const out: RawPlace[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const { places, nextPageToken } = await searchTextCell(textQuery, cell, pageToken);
    for (const p of places) {
      const r = mapPlace(p);
      if (r) out.push(r);
    }
    if (!nextPageToken || places.length === 0) break;
    pageToken = nextPageToken;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

// تقسيم تكيّفي: إذا الخلية أعادت 60 نتيجة (مشبعة) وقطرها > minMeters → قسّمها
const SATURATION = 55;
const MIN_CELL_METERS = 400;

export async function searchCellAdaptive(
  textQuery: string,
  cell: Cell,
  depth = 0,
  maxDepth = 5,
): Promise<RawPlace[]> {
  const results = await searchCellAllPages(textQuery, cell);
  if (results.length >= SATURATION && depth < maxDepth && cellDiagonalMeters(cell) > MIN_CELL_METERS) {
    // قسّم لـ 4 وأعد البحث بالتوازي
    const subs = splitCell(cell);
    const settled = await Promise.allSettled(
      subs.map((sc) => searchCellAdaptive(textQuery, sc, depth + 1, maxDepth)),
    );
    const merged: RawPlace[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (!seen.has(r.place_id)) {
        seen.add(r.place_id);
        merged.push(r);
      }
    }
    for (const s of settled) {
      if (s.status === "fulfilled") {
        for (const r of s.value) {
          if (!seen.has(r.place_id)) {
            seen.add(r.place_id);
            merged.push(r);
          }
        }
      }
    }
    return merged;
  }
  return results;
}

// ---------------- Pool helper ----------------
export async function pool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, idx: number) => Promise<R>,
  onItemDone?: (idx: number, result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function runNext(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const r = await worker(items[i], i);
        results[i] = r;
        onItemDone?.(i, r);
      } catch {
        // ignore individual failures
      }
    }
  }
  const workers = Array.from({ length: Math.min(size, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}
