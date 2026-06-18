import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginWithPassword } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PasswordInput } from "@/components/password-input";
import { Loader2, LogIn } from "lucide-react";

import { PageErrorComponent } from "@/components/page-error-boundary";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  errorComponent: PageErrorComponent,
  head: () => ({ meta: [{ title: "تسجيل الدخول — جميل ماب" }] }),
});

const ATTEMPTS_KEY = "login_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function getAuthStorageKey(): string {
  const explicit = import.meta.env.VITE_SUPABASE_AUTH_STORAGE_KEY;
  if (explicit) return explicit;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (projectId) return `sb-${projectId}-auth-token`;
  try {
    const host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
    return `sb-${host}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

function getLockoutRemaining(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return 0;
    const { n, lockedUntil } = JSON.parse(raw) as { n: number; lockedUntil: number };
    if (n >= MAX_ATTEMPTS && lockedUntil > Date.now()) return lockedUntil - Date.now();
    return 0;
  } catch { return 0; }
}

function bumpAttempts() {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    const cur = raw ? JSON.parse(raw) as { n: number; lockedUntil: number } : { n: 0, lockedUntil: 0 };
    const n = cur.n + 1;
    const lockedUntil = n >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ n, lockedUntil }));
  } catch { /* ignore */ }
}

function clearAttempts() {
  try { sessionStorage.removeItem(ATTEMPTS_KEY); } catch { /* ignore */ }
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "البريد أو كلمة المرور غير صحيحة";
  if (m.includes("email not confirmed")) return "البريد لم يُؤكَّد بعد";
  if (m.includes("too many requests") || m.includes("rate limit")) return "محاولات كثيرة — انتظر قليلاً ثم حاول مجدداً";
  if (m.includes("network")) return "تعذّر الاتصال بالخادم — تحقق من الإنترنت";
  return msg;
}

function LoginPage() {
  const backendLogin = useServerFn(loginWithPassword);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockSec, setLockSec] = useState(0);

  // مؤقت قفل بعد المحاولات الزائدة
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const r = getLockoutRemaining();
      setLockSec(Math.ceil(r / 1000));
      if (r > 0) t = setTimeout(tick, 1000);
    };
    tick();
    return () => { if (t) clearTimeout(t); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const remaining = getLockoutRemaining();
    if (remaining > 0) {
      setError(`تم تعطيل الدخول مؤقتاً. حاول بعد ${Math.ceil(remaining / 1000)} ثانية.`);
      return;
    }
    setLoading(true);
    try {
      const direct = await supabase.auth.signInWithPassword({ email, password }).catch((err) => ({
        error: err instanceof Error ? err : new Error("Failed to fetch"),
      }));
      let error = direct.error;
      if (error && /failed to fetch|fetch|network/i.test(error.message)) {
        const session = await backendLogin({ data: { email, password } });
        localStorage.setItem(getAuthStorageKey(), JSON.stringify(session));
        const restored = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        error = restored.error;
      }
      setLoading(false);
      if (error) {
        bumpAttempts();
        setError(translateAuthError(error.message));
        const r = getLockoutRemaining();
        if (r > 0) setLockSec(Math.ceil(r / 1000));
        return;
      }
      clearAttempts();
      // تحميل صلب للصفحة بعد الدخول لضمان جاهزية الجلسة
      window.location.assign("/");
    } catch (err) {
      setLoading(false);
      setError(translateAuthError((err as Error)?.message ?? "حدث خطأ غير متوقع"));
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex justify-center"><Logo size={48} /></div>
        <h1 className="text-center text-xl font-bold text-foreground">تسجيل الدخول</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          أدخل بياناتك للوصول إلى لوحة جميل ماب
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">كلمة المرور</Label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>
            <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          {lockSec > 0 && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">معطّل مؤقتاً — حاول بعد {lockSec}ث</p>}
          <Button type="submit" disabled={loading || lockSec > 0} className="w-full" size="lg">
            {loading ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الدخول...</> : <><LogIn className="ml-2 h-4 w-4" /> دخول</>}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          أول مرة؟ <Link to="/bootstrap" className="font-semibold text-primary underline">تهيئة حساب المسؤول</Link>
        </p>
      </Card>
    </main>
  );
}
