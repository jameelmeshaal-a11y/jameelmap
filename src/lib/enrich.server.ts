// إثراء البيانات من موقع المنشأة:
// 1) محاولة Firecrawl (لو متاح ولديه رصيد)
// 2) Fallback: fetch HTML مباشر + regex — مجاني وموثوق

export interface EnrichmentResult {
  email: string;
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  tiktok: string;
  snapchat: string;
  whatsapp: string;
}

export const EMPTY_ENRICHMENT: EnrichmentResult = {
  email: "", facebook: "", instagram: "", twitter: "", youtube: "", tiktok: "", snapchat: "", whatsapp: "",
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_BAD = /(noreply|no-reply|donotreply|wixpress|sentry\.io|example\.com|domain\.com|yourname|@2x|email@|test@|user@|sample@|name@)/i;
const EMAIL_EXT_BAD = /\.(png|jpe?g|webp|gif|svg|css|js|ico|woff2?)$/i;

const SOCIAL_PATTERNS: Array<{ key: keyof EnrichmentResult; re: RegExp }> = [
  { key: "facebook",  re: /https?:\/\/(?:www\.|m\.|web\.|business\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/gi },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/gi },
  { key: "twitter",   re: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_.\-/]+/gi },
  { key: "youtube",   re: /https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)[A-Za-z0-9_.\-/]+/gi },
  { key: "tiktok",    re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-/]+/gi },
  { key: "snapchat",  re: /https?:\/\/(?:www\.)?snapchat\.com\/add\/[A-Za-z0-9_.\-/]+/gi },
];

const WHATSAPP_PATTERNS = [
  /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\/?\??(?:phone=)?(\+?\d{8,15})/gi,
  /whatsapp[:\s]+(\+?\d{8,15})/gi,
];

const MAILTO_RE = /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;

function pickEmail(text: string): string {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  MAILTO_RE.lastIndex = 0;
  while ((m = MAILTO_RE.exec(text)) !== null) {
    const e = m[1].toLowerCase();
    if (!EMAIL_BAD.test(e) && !EMAIL_EXT_BAD.test(e)) found.add(e);
  }
  if (found.size > 0) return [...found][0];
  EMAIL_RE.lastIndex = 0;
  for (const raw of text.match(EMAIL_RE) ?? []) {
    const e = raw.toLowerCase();
    if (!EMAIL_BAD.test(e) && !EMAIL_EXT_BAD.test(e) && !e.startsWith("u+00") && e.length < 80) {
      return e;
    }
  }
  return "";
}

function pickSocials(text: string): Partial<EnrichmentResult> {
  const out: Partial<EnrichmentResult> = {};
  for (const { key, re } of SOCIAL_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const url = m[0].replace(/[)\].,;'"]+$/, "");
      // تجاهل روابط sharer/intent
      if (/\/(sharer|share|intent|dialog\/share|plugins)\b/i.test(url)) continue;
      out[key] = url;
    }
  }
  return out;
}

function pickWhatsapp(text: string, phoneHint: string): string {
  for (const re of WHATSAPP_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) {
      const digits = m[1].replace(/[^\d+]/g, "");
      if (digits.length >= 8) return digits.startsWith("+") ? digits : `+${digits}`;
    }
  }
  // إذا الرقم الأصلي دولي صالح، اعتبره واتساب محتمل
  if (phoneHint && /^\+\d{10,15}$/.test(phoneHint)) return phoneHint;
  return "";
}

function buildCandidatePages(baseUrl: string): string[] {
  try {
    const u = new URL(baseUrl);
    const root = `${u.protocol}//${u.host}`;
    return [
      baseUrl,
      `${root}/contact`,
      `${root}/contact-us`,
      `${root}/contact.html`,
      `${root}/about`,
    ];
  } catch {
    return [baseUrl];
  }
}

async function fetchHtml(url: string, timeoutMs = 7000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AalamJameelBot/1.0; +https://jameelmap.lovable.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en,ar;q=0.8",
      },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ct)) return "";
    // اقرأ بحد أقصى ~1MB
    const text = await res.text();
    return text.length > 1_000_000 ? text.slice(0, 1_000_000) : text;
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

async function enrichViaFirecrawl(url: string): Promise<EnrichmentResult | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false }),
    });
    if (!res.ok) return null; // 402 رصيد أو أي خطأ ⇒ fallback
    const j = await res.json() as {
      success?: boolean;
      data?: { markdown?: string; links?: string[] };
      markdown?: string;
      links?: string[];
    };
    if (j.success === false) return null;
    const md = j.data?.markdown ?? j.markdown ?? "";
    const links = j.data?.links ?? j.links ?? [];
    const haystack = md + "\n" + links.join("\n");
    return {
      ...EMPTY_ENRICHMENT,
      email: pickEmail(haystack),
      ...pickSocials(haystack),
      whatsapp: pickWhatsapp(haystack, ""),
    };
  } catch {
    return null;
  }
}

async function enrichViaHtmlFallback(url: string, phoneHint: string): Promise<EnrichmentResult> {
  const pages = buildCandidatePages(url);
  const result: EnrichmentResult = { ...EMPTY_ENRICHMENT };

  for (const page of pages) {
    if (result.email && result.facebook && result.instagram) break; // غني كفاية
    const html = await fetchHtml(page);
    if (!html) continue;
    if (!result.email) {
      const e = pickEmail(html);
      if (e) result.email = e;
    }
    const socials = pickSocials(html);
    for (const [k, v] of Object.entries(socials)) {
      const key = k as keyof EnrichmentResult;
      if (v && !result[key]) result[key] = v;
    }
    if (!result.whatsapp) {
      const w = pickWhatsapp(html, phoneHint);
      if (w) result.whatsapp = w;
    }
  }
  return result;
}

export async function enrichFromWebsite(url: string, phoneHint = ""): Promise<EnrichmentResult> {
  if (!url) return { ...EMPTY_ENRICHMENT, whatsapp: phoneHint && /^\+\d{10,15}$/.test(phoneHint) ? phoneHint : "" };

  // محاولة Firecrawl أولاً
  const fc = await enrichViaFirecrawl(url);
  if (fc && (fc.email || fc.facebook || fc.instagram || fc.twitter)) {
    // كمّل الناقص بـ HTML fallback
    if (!fc.email || !fc.whatsapp) {
      const extra = await enrichViaHtmlFallback(url, phoneHint);
      return {
        email: fc.email || extra.email,
        facebook: fc.facebook || extra.facebook,
        instagram: fc.instagram || extra.instagram,
        twitter: fc.twitter || extra.twitter,
        youtube: fc.youtube || extra.youtube,
        tiktok: fc.tiktok || extra.tiktok,
        snapchat: fc.snapchat || extra.snapchat,
        whatsapp: fc.whatsapp || extra.whatsapp,
      };
    }
    return fc;
  }

  // Fallback مباشر
  return enrichViaHtmlFallback(url, phoneHint);
}

// تشغيل بدفعات بحجم معيّن
export async function runInBatches<T, R>(
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

// تطبيع اسم المنشأة لاكتشاف التكرار
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل العربي
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
