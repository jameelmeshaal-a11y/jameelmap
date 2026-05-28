// جلب ديناميكي للمدن داخل دولة محددة عبر Places API (New)
// يستخدم Autocomplete + searchText بعدّة بذور ولغات، يُكاش لـ 30 يوم
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  country: z.string().trim().min(1).max(100),
  forceRefresh: z.boolean().optional(),
});

interface City {
  name: string;
  score: number;
}

const SEEDS_LATIN = "abcdefghijklmnopqrstuvwxyz".split("");
const SEEDS_ARABIC = ["ا","ب","ت","ج","ح","خ","د","ر","س","ش","ص","ط","ع","ف","ق","ك","ل","م","ن","ه","و","ي"];
// أنواع موسّعة لالتقاط البلدات والقرى الصغيرة (مثل: رماح)
const INCLUDED_TYPES = ["locality", "sublocality", "administrative_area_level_3", "administrative_area_level_2"];

export const fetchCitiesForCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { countryNameToCode } = await import("@/lib/country-codes");
    const { readCacheRaw, writeCacheRaw, citiesCacheKey } = await import("@/lib/cache.server");

    const code = countryNameToCode(data.country);
    if (!code) {
      return { cities: [], code: null, error: `لم يتم التعرف على الدولة "${data.country}". اكتب اسمها بالإنجليزية أو رمز ISO (مثال: US, SA, EG).` };
    }

    // v2: مفتاح كاش جديد لإبطال البيانات القديمة المحدودة
    const cacheKey = `${citiesCacheKey(code)}_v2`;
    if (!data.forceRefresh) {
      const hit = await readCacheRaw<{ cities: City[] }>(cacheKey);
      if (hit) {
        return { cities: hit.data.cities, code, cachedAt: hit.cachedAt, error: null };
      }
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { cities: [], code, error: "موصل Google Maps غير مربوط. اربطه من إعدادات الموصلات." };
    }

    const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
    };

    const cityMap = new Map<string, City>();
    const upsert = (name: string, bonus = 1) => {
      const clean = name.trim();
      if (!clean || clean.length > 80) return;
      const key = clean.toLowerCase();
      const cur = cityMap.get(key);
      if (cur) cur.score += bonus;
      else cityMap.set(key, { name: clean, score: bonus });
    };

    // 1) Autocomplete بذور لاتينية (en) + عربية (ar) بالتوازي — أنواع موسّعة
    const tasks: Promise<void>[] = [];
    const runAutocomplete = (seed: string, languageCode: string) => tasks.push((async () => {
      try {
        const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: seed,
            includedPrimaryTypes: INCLUDED_TYPES,
            includedRegionCodes: [code.toLowerCase()],
            languageCode,
          }),
        });
        if (!res.ok) return;
        const json = await res.json() as { suggestions?: Array<{ placePrediction?: { structuredFormat?: { mainText?: { text?: string } } } }> };
        for (const s of json.suggestions ?? []) {
          const name = s.placePrediction?.structuredFormat?.mainText?.text;
          if (name) upsert(name, 2);
        }
      } catch { /* تجاهل خطأ بذرة واحدة */ }
    })());
    for (const s of SEEDS_LATIN) runAutocomplete(s, "en");
    for (const s of SEEDS_ARABIC) runAutocomplete(s, "ar");
    await Promise.all(tasks);

    // 2) searchText بدون فلتر صارم — استعلامان لتوسعة التغطية
    const TEXT_QUERIES = [
      `cities in ${data.country}`,
      `towns and villages in ${data.country}`,
    ];
    await Promise.all(TEXT_QUERIES.map(async (textQuery) => {
      try {
        const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
          method: "POST",
          headers: { ...headers, "X-Goog-FieldMask": "places.displayName,places.shortFormattedAddress,places.types" },
          body: JSON.stringify({
            textQuery,
            regionCode: code.toLowerCase(),
            languageCode: "en",
            pageSize: 20,
          }),
        });
        if (res.ok) {
          const json = await res.json() as { places?: Array<{ displayName?: { text?: string } }> };
          for (const p of json.places ?? []) {
            const name = p.displayName?.text;
            if (name) upsert(name, 3);
          }
        }
      } catch { /* تجاهل */ }
    }));

    const cities = Array.from(cityMap.values()).sort((a, b) => b.score - a.score);
    await writeCacheRaw(cacheKey, { cities }, 30, cities.length);

    return { cities, code, cachedAt: null, error: cities.length === 0 ? "تعذّر جلب أي مدينة. جرّب مجدداً لاحقاً." : null };
  });
