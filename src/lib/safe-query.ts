// أدوات أمان لقاعدة البيانات والاستعلامات
export const MAX_DB_ROWS = 50_000;

/** سقف عام لأي قراءة قد ترجع عددًا كبيرًا */
export function capRange(limit?: number): number {
  if (!limit || limit > MAX_DB_ROWS) return MAX_DB_ROWS;
  return limit;
}

/** يلف وعداً بحيث لا يرمي — يرجع نتيجة موحّدة */
export async function safeRun<T>(fn: () => Promise<T>, label = "operation"): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[safeRun:${label}]`, msg);
    return { ok: false, error: msg };
  }
}

/** يلف عملية كتابة قاعدة بيانات (insert/update/delete) بحيث لا تُفشل المهمة عند خطأ */
export async function safeWrite<T>(label: string, p: PromiseLike<T>): Promise<T | null> {
  try {
    const res = await p;
    // supabase يرجع { error } بدل رمي — نتحقق
    if (res && typeof res === "object" && "error" in (res as Record<string, unknown>)) {
      const err = (res as { error: { message?: string } | null }).error;
      if (err) {
        console.error(`[safeWrite:${label}]`, err.message ?? err);
        return null;
      }
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[safeWrite:${label}]`, msg);
    return null;
  }
}
