// محرك جمع البيانات — يستخدم تقسيم شبكي تكيّفي لاستخراج ~كل المتاجر،
// ويعالج 5 مدن بالتوازي مع تتبع تقدم لكل مدينة عبر scrape_job_cities.
// إصلاحات هامة:
// - حفظ بدُفعات صغيرة (50) فور توفر النتائج لتفادي تجمّد 88%
// - فحص حالة الإيقاف (stopped) بشكل دوري
// - احترام max_results لكل وظيفة
// - إثراء المواقع يحدّث الصفوف المحفوظة، لا يحجبها

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCities, MOSQUE_KEYWORDS, isMosqueActivity } from "@/lib/country-cities";
import { enrichFromWebsite, runInBatches, normalizeName, EMPTY_ENRICHMENT } from "@/lib/enrich.server";
import {
  geocodeCity, tileViewport, searchCellAdaptive, pool,
  type RawPlace,
} from "@/lib/places-grid.server";

const CITY_CONCURRENCY = 5;
const CELL_CONCURRENCY = 6;
const ENRICH_CONCURRENCY = 4;
const GRID_SIZE = 4;
const SAVE_CHUNK = 50;
const DEFAULT_MAX_RESULTS = 2000;
const HARD_CAP = 20000;

async function isJobStopped(jobId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("scrape_jobs")
    .select("status, stopped_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) return true;
  return data.status === "stopped" || !!data.stopped_at;
}

async function updateCity(
  jobId: string,
  city: string,
  patch: Partial<{
    status: string; progress: number; results_count: number;
    current_step: string; error_message: string;
  }>,
): Promise<void> {
  await supabaseAdmin
    .from("scrape_job_cities")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("city", city);
}

async function ensureCityRow(jobId: string, city: string): Promise<void> {
  await supabaseAdmin
    .from("scrape_job_cities")
    .upsert({ job_id: jobId, city, status: "pending" }, { onConflict: "job_id,city", ignoreDuplicates: true });
}

async function saveBatch(jobId: string, rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await (supabaseAdmin.from("scrape_results") as unknown as {
    upsert: (rows: unknown, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, { onConflict: "job_id,place_id", ignoreDuplicates: true });
  if (error) {
    console.error("[saveBatch]", error.message);
    return 0;
  }
  return rows.length;
}

interface ProcessCityResult {
  city: string;
  saved: number;
  error?: string;
}

async function processCity(
  jobId: string,
  city: string,
  country: string,
  keywords: string[],
  globalSeen: Set<string>,
  globalDedupKeys: Set<string>,
  remainingBudget: () => number,
): Promise<ProcessCityResult> {
  await updateCity(jobId, city, { status: "running", current_step: "جاري تحديد الإحداثيات", progress: 2 });

  if (await isJobStopped(jobId)) {
    await updateCity(jobId, city, { status: "failed", current_step: "تم الإيقاف", error_message: "تم إيقاف المهمة", progress: 100 });
    return { city, saved: 0, error: "stopped" };
  }

  const geo = await geocodeCity(city, country);
  if (!geo) {
    await updateCity(jobId, city, {
      status: "failed", current_step: "تعذّر تحديد الإحداثيات",
      error_message: "تعذّر تحديد الإحداثيات", progress: 100,
    });
    return { city, saved: 0, error: "geocode failed" };
  }

  const cells = tileViewport(geo.viewport, GRID_SIZE);
  const totalUnits = cells.length * Math.max(1, keywords.length);
  let doneUnits = 0;
  const localResults: RawPlace[] = [];
  const localSeen = new Set<string>();

  await updateCity(jobId, city, { current_step: `0/${cells.length} خلية`, progress: 5 });

  type Task = { kw: string; cellIdx: number };
  const tasks: Task[] = [];
  for (const kw of keywords) {
    for (let i = 0; i < cells.length; i++) tasks.push({ kw, cellIdx: i });
  }

  let stoppedFlag = false;
  await pool(tasks, CELL_CONCURRENCY, async (t) => {
    if (stoppedFlag) return;
    if (remainingBudget() <= 0) return;
    try {
      const results = await searchCellAdaptive(`${t.kw} in ${city}`, cells[t.cellIdx]);
      for (const r of results) {
        if (!localSeen.has(r.place_id)) {
          localSeen.add(r.place_id);
          localResults.push(r);
        }
      }
    } catch (e) {
      console.error(`[${city}] cell ${t.cellIdx} kw="${t.kw}" failed:`, e);
    } finally {
      doneUnits++;
      if (doneUnits % 4 === 0 || doneUnits === totalUnits) {
        // فحص دوري للإيقاف
        if (doneUnits % 8 === 0 && await isJobStopped(jobId)) stoppedFlag = true;
        const progress = Math.min(70, 5 + Math.round((doneUnits / totalUnits) * 60));
        await updateCity(jobId, city, {
          progress,
          current_step: `بحث: ${doneUnits}/${totalUnits} خلية · ${localResults.length} نتيجة`,
          results_count: localResults.length,
        });
      }
    }
  });

  if (stoppedFlag) {
    await updateCity(jobId, city, { status: "failed", current_step: "تم الإيقاف", error_message: "تم إيقاف المهمة", progress: 100 });
    return { city, saved: 0, error: "stopped" };
  }

  // Dedup عالمياً
  const fresh: RawPlace[] = [];
  for (const r of localResults) {
    if (remainingBudget() <= fresh.length) break;
    if (globalSeen.has(r.place_id)) continue;
    const nameKey = `n:${normalizeName(r.name)}|${city.toLowerCase()}`;
    const phoneKey = r.phone ? `p:${r.phone}` : "";
    if (globalDedupKeys.has(nameKey)) continue;
    if (phoneKey && globalDedupKeys.has(phoneKey)) continue;
    globalSeen.add(r.place_id);
    globalDedupKeys.add(nameKey);
    if (phoneKey) globalDedupKeys.add(phoneKey);
    fresh.push(r);
  }

  // ✅ احفظ الصفوف الأساسية فوراً بدُفعات 50 (قبل الإثراء) — يحلّ تجمد 88%
  await updateCity(jobId, city, {
    progress: 75,
    current_step: `حفظ ${fresh.length} سجل أساسي...`,
  });

  let saved = 0;
  for (let i = 0; i < fresh.length; i += SAVE_CHUNK) {
    if (await isJobStopped(jobId)) {
      await updateCity(jobId, city, { status: "failed", current_step: "تم الإيقاف", error_message: "تم إيقاف المهمة", progress: 100 });
      return { city, saved, error: "stopped" };
    }
    const chunk = fresh.slice(i, i + SAVE_CHUNK).map((r) => ({
      job_id: jobId,
      place_id: r.place_id,
      name: r.name,
      address: r.address,
      city,
      state: r.state,
      country,
      phone: r.phone,
      whatsapp: r.whatsapp ?? "",
      website: r.website,
      category: r.category,
      maps_url: r.maps_url,
      email: "",
    }));
    saved += await saveBatch(jobId, chunk);
    await updateCity(jobId, city, {
      progress: 75 + Math.round(((i + chunk.length) / Math.max(1, fresh.length)) * 8),
      current_step: `حفظ ${Math.min(i + SAVE_CHUNK, fresh.length)}/${fresh.length}`,
      results_count: saved,
    });
  }

  // الإثراء (إيميل/سوشيال) للمواقع — يحدّث الصفوف المحفوظة، اختياري
  const toEnrich = fresh.filter((r) => r.website);
  if (toEnrich.length > 0) {
    await updateCity(jobId, city, {
      progress: 85,
      current_step: `إثراء ${toEnrich.length} موقع (اختياري)`,
    });

    let enriched = 0;
    await runInBatches(toEnrich, ENRICH_CONCURRENCY, async (r) => {
      if (await isJobStopped(jobId)) return;
      try {
        const e = await enrichFromWebsite(r.website, r.phone);
        if (e.email || e.facebook || e.instagram || e.whatsapp) {
          const patch: Record<string, string> = {};
          if (e.email) patch.email = e.email;
          if (e.facebook) patch.facebook = e.facebook;
          if (e.instagram) patch.instagram = e.instagram;
          if (e.twitter) patch.twitter = e.twitter;
          if (e.youtube) patch.youtube = e.youtube;
          if (e.tiktok) patch.tiktok = e.tiktok;
          if (e.snapchat) patch.snapchat = e.snapchat;
          if (e.whatsapp) patch.whatsapp = e.whatsapp;
          patch.email_scraped_at = new Date().toISOString();
          await supabaseAdmin
            .from("scrape_results")
            .update(patch)
            .eq("job_id", jobId)
            .eq("place_id", r.place_id);
        }
      } catch {
        /* تجاهل أخطاء الإثراء الفردية */
      }
      enriched++;
      if (enriched % 10 === 0) {
        await updateCity(jobId, city, {
          progress: 85 + Math.round((enriched / toEnrich.length) * 14),
          current_step: `إثراء ${enriched}/${toEnrich.length}`,
        });
      }
    });
  }

  void EMPTY_ENRICHMENT;

  await updateCity(jobId, city, {
    status: "done",
    progress: 100,
    results_count: saved,
    current_step: `مكتملة · ${saved} نتيجة فريدة`,
  });

  return { city, saved };
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

  // اقرأ max_results للوظيفة
  const { data: jobRow } = await supabaseAdmin
    .from("scrape_jobs")
    .select("max_results, status")
    .eq("id", jobId)
    .maybeSingle();
  const maxResults = Math.min(HARD_CAP, jobRow?.max_results ?? DEFAULT_MAX_RESULTS);

  const { data: cityRows } = await supabaseAdmin
    .from("scrape_job_cities")
    .select("city")
    .eq("job_id", jobId);

  let cities: string[] = (cityRows ?? []).map((r) => r.city as string);
  if (cities.length === 0) {
    cities = resolveCities(country).cities;
    if (cities.length > 0) {
      await supabaseAdmin
        .from("scrape_job_cities")
        .insert(cities.map((c) => ({ job_id: jobId, city: c, status: "pending" })));
    }
  } else {
    for (const c of cities) await ensureCityRow(jobId, c);
  }

  const isMosque = isMosqueActivity(activity);
  const keywords = isMosque ? MOSQUE_KEYWORDS.slice(0, 4) : [activity];

  await supabaseAdmin.from("scrape_jobs").update({
    status: "running",
    cities_total: cities.length,
    cities_done: 0,
    results_count: 0,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  const globalSeen = new Set<string>();
  const globalDedupKeys = new Set<string>();
  let totalSaved = 0;
  let citiesDone = 0;
  let citiesFailed = 0;
  let lastError = "";

  const remainingBudget = () => Math.max(0, maxResults - totalSaved);

  try {
    await pool(cities, CITY_CONCURRENCY, async (city) => {
      if (await isJobStopped(jobId)) return { city, saved: 0, error: "stopped" } as ProcessCityResult;
      if (remainingBudget() <= 0) {
        await updateCity(jobId, city, { status: "done", progress: 100, current_step: "تم بلوغ الحد الأقصى", results_count: 0 });
        return { city, saved: 0 } as ProcessCityResult;
      }

      await supabaseAdmin.from("scrape_jobs").update({
        current_city: city,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      const res = await processCity(jobId, city, country, keywords, globalSeen, globalDedupKeys, remainingBudget);
      if (res.error && res.error !== "stopped") {
        citiesFailed++;
        lastError = res.error;
      }
      totalSaved += res.saved;
      citiesDone++;

      await supabaseAdmin.from("scrape_jobs").update({
        cities_done: citiesDone,
        results_count: totalSaved,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      return res;
    });

    // الحالة النهائية
    if (await isJobStopped(jobId)) {
      await supabaseAdmin.from("scrape_jobs").update({
        status: "stopped",
        current_city: "",
        results_count: totalSaved,
        error_message: `تم إيقاف المهمة يدوياً (حُفظ ${totalSaved} سجل)`,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    const allFailed = citiesFailed === cities.length;
    if (allFailed) {
      await supabaseAdmin.from("scrape_jobs").update({
        status: "failed",
        current_city: "",
        error_message: `فشلت جميع المدن (${cities.length}). آخر خطأ: ${lastError || "غير معروف"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    await supabaseAdmin.from("scrape_jobs").update({
      status: "completed",
      current_city: "",
      cities_done: cities.length,
      results_count: totalSaved,
      error_message: citiesFailed > 0 ? `تنبيه: فشلت ${citiesFailed} مدينة` : "",
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

// إعادة إثراء وظيفة موجودة
export async function reEnrichJob(jobId: string): Promise<{ updated: number; total: number }> {
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

// إزالة التكرار من وظيفة موجودة
export async function dedupJob(jobId: string): Promise<{ removed: number; kept: number }> {
  const { data: rows } = await supabaseAdmin
    .from("scrape_results")
    .select("id, name, city, phone, email, website, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(20000);

  if (!rows || rows.length === 0) return { removed: 0, kept: 0 };

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
