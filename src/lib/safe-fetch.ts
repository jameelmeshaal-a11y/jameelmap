// طبقة حماية لاستدعاءات الشبكة: timeout + لا رمي
export const DEFAULT_TIMEOUT_MS = 15_000;

export async function withTimeout<T>(p: Promise<T>, ms = DEFAULT_TIMEOUT_MS, label = "request"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`انتهت مهلة ${label} (${Math.round(ms / 1000)}s)`)), ms);
  });
  try {
    return (await Promise.race([p, timeout])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface SafeFetchResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

export async function safeFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; parse?: "json" | "text" | "none" } = {},
): Promise<SafeFetchResult<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const parse = opts.parse ?? "json";
    let data: unknown = null;
    if (parse === "json") {
      const txt = await res.text();
      try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
    } else if (parse === "text") {
      data = await res.text();
    }
    if (!res.ok) {
      return { ok: false, data: null, error: typeof data === "string" ? data : `HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, data: data as T, error: null, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? `انتهت المهلة (${Math.round(timeoutMs / 1000)}s)` : e.message) : String(e);
    return { ok: false, data: null, error: msg, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
