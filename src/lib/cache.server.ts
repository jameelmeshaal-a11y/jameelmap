// كاش بحث + كاش مدن — يعتمد جدول search_cache في Supabase
// TTL مرن لكل عملية (3 أيام للبحث، 30 يوم للمدن)
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function sha1(s: string): string {
  // sha1 خفيف بدون اعتماديات (Web Crypto غير متاحة في كل runtime sync)
  // — لأغراض كاش فقط، نستخدم خوارزمية بسيطة (FNV-1a 64bit) + base36
  let h1 = 0xcbf29ce4, h2 = 0x84222325;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 ^= c; h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

export function searchCacheKey(country: string, activity: string, city: string): string {
  const raw = [country, activity, city].map((x) => (x || "").trim().toLowerCase()).join("|");
  return `search_${sha1(raw)}`;
}

export function citiesCacheKey(countryCode: string): string {
  return `cities_${countryCode.toUpperCase()}`;
}

// قراءة عامة — يرجّع data + fromCache=true إن وُجد وغير منتهي
export async function readCacheRaw<T = unknown>(key: string): Promise<{ data: T; cachedAt: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("search_cache")
    .select("data, created_at, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data) return null;
  const exp = new Date(data.expires_at as string).getTime();
  if (exp < Date.now()) return null;
  return { data: data.data as T, cachedAt: data.created_at as string };
}

// كتابة عامة — TTL بالأيام
export async function writeCacheRaw(key: string, data: unknown, ttlDays: number, resultCount = 0): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();
  await supabaseAdmin
    .from("search_cache")
    .upsert(
      {
        cache_key: key,
        data: data as never,
        expires_at: expiresAt,
        result_count: resultCount,
        created_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
}

// واجهات مختصرة للبحث (3 أيام)
export async function readSearchCache<T>(country: string, activity: string, city: string): Promise<T | null> {
  const hit = await readCacheRaw<T>(searchCacheKey(country, activity, city));
  return hit?.data ?? null;
}
export async function writeSearchCache(country: string, activity: string, city: string, rows: unknown[]): Promise<void> {
  await writeCacheRaw(searchCacheKey(country, activity, city), rows, 3, rows.length);
}
