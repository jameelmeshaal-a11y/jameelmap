// محرّك جلب الإيميلات من المواقع — يجلب /, /contact, /contact-us, /about بالتوازي
// ويفلتر الدومينات الشائعة والملفّات الثنائية

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const BLOCKED_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "live.com", "aol.com", "mail.ru", "qq.com", "163.com", "126.com",
  "sentry.io", "wixpress.com", "example.com", "domain.com", "email.com",
  "test.com", "sample.com", "yourdomain.com", "u.com", "x.com",
]);

const BLOCKED_PREFIXES = [
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "postmaster", "mailer-daemon", "abuse", "spam",
];

const BLOCKED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".css", ".js"];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function isBadEmail(e: string): boolean {
  const lower = e.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) if (lower.endsWith(ext)) return true;
  const at = lower.lastIndexOf("@");
  if (at < 1) return true;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (BLOCKED_DOMAINS.has(domain)) return true;
  for (const p of BLOCKED_PREFIXES) if (local.startsWith(p)) return true;
  // إيميلات تحوي رموز غير منطقية أو طولاً مفرطاً
  if (e.length > 80 || local.length < 2) return true;
  return false;
}

function extractEmails(html: string): string[] {
  if (!html) return [];
  const found = html.match(EMAIL_REGEX) ?? [];
  const out = new Set<string>();
  for (const e of found) {
    const trimmed = e.trim().toLowerCase();
    if (!isBadEmail(trimmed)) out.add(trimmed);
  }
  return [...out];
}

async function fetchPage(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/") && !ct.includes("html")) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    return parsed.origin;
  } catch {
    return "";
  }
}

export interface EmailScrapeResult {
  primary: string;
  all: string[];
}

export async function scrapeEmailsFromSite(website: string): Promise<EmailScrapeResult> {
  const base = normalizeUrl(website);
  if (!base) return { primary: "", all: [] };

  const paths = ["/", "/contact", "/contact-us", "/about", "/about-us", "/ar/contact", "/en/contact"];
  const pages = await Promise.allSettled(paths.map((p) => fetchPage(base + p)));

  const all = new Set<string>();
  for (const pg of pages) {
    if (pg.status !== "fulfilled") continue;
    for (const e of extractEmails(pg.value)) all.add(e);
  }

  const arr = [...all];
  // الأفضلية: ما يحوي اسم الدومين الأصلي
  let host = "";
  try { host = new URL(base).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  arr.sort((a, b) => {
    const aMatch = host && a.endsWith("@" + host) ? 1 : 0;
    const bMatch = host && b.endsWith("@" + host) ? 1 : 0;
    return bMatch - aMatch;
  });

  return { primary: arr[0] ?? "", all: arr };
}
