import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/safe-fetch";

const REDIRECT_KEY = "auth_redirect_count";
const REDIRECT_WINDOW_MS = 5_000;
const MAX_REDIRECTS = 3;

function bumpRedirectCounter(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(REDIRECT_KEY);
    const now = Date.now();
    const parsed = raw ? JSON.parse(raw) as { ts: number; n: number } : null;
    if (parsed && now - parsed.ts < REDIRECT_WINDOW_MS) {
      const n = parsed.n + 1;
      sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ ts: parsed.ts, n }));
      return n;
    }
    sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ ts: now, n: 1 }));
    return 1;
  } catch {
    return 0;
  }
}

function clearRedirectCounter() {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(REDIRECT_KEY); } catch { /* ignore */ }
}

function safeRedirectToLogin(): never {
  const n = bumpRedirectCounter();
  if (n > MAX_REDIRECTS) {
    clearRedirectCounter();
    throw new Error("تعذّر التحقق من جلستك بعد عدة محاولات. سجّل الدخول يدوياً من /login.");
  }
  throw redirect({ to: "/login" });
}

export async function requireBrowserUser() {
  if (typeof window === "undefined") return null;

  try {
    const { data, error } = await withTimeout(supabase.auth.getUser(), 10_000, "auth.getUser");
    if (error || !data.user) safeRedirectToLogin();
    clearRedirectCounter();
    return data.user;
  } catch (e) {
    // redirect() من tanstack يُلتقط هنا — لا نعيد رميه يدوياً إلا إذا كان Error عادي
    if (e instanceof Error && e.message.includes("/login")) throw e;
    if (e && typeof e === "object" && "to" in (e as object)) throw e; // redirect object
    safeRedirectToLogin();
  }
}

export async function requireBrowserAdmin() {
  const user = await requireBrowserUser();
  if (!user) return null;

  try {
    const res = await withTimeout(
      Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()),
      10_000,
      "user_roles",
    );
    const role = res.data;
    if (!role || role.role !== "admin") throw redirect({ to: "/" });
    return user;
  } catch (e) {
    if (e && typeof e === "object" && "to" in (e as object)) throw e;
    throw redirect({ to: "/" });
  }
}
