import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PasswordInput } from "@/components/password-input";
import { Loader2, KeyRound } from "lucide-react";
import { PageErrorComponent } from "@/components/page-error-boundary";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  errorComponent: PageErrorComponent,
  head: () => ({ meta: [{ title: "تعيين كلمة مرور جديدة — جميل ماب" }] }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  // Supabase يضع access_token ضمن الـ hash عند الوصول من رابط recovery، ويُهيّئ الجلسة تلقائياً.
  // نتأكد من وجود جلسة recovery قبل إظهار النموذج.
  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (mounted) setRecoveryReady(true);
      }
    });
    // فحص مبدئي
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setRecoveryReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== confirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) { setError(error.message || "تعذّر تحديث كلمة المرور"); return; }
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => { window.location.href = "/login"; }, 1500);
    } catch (err) {
      setLoading(false);
      setError((err as Error)?.message ?? "حدث خطأ غير متوقع");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex justify-center"><Logo size={48} /></div>
        <h1 className="text-center text-xl font-bold text-foreground">تعيين كلمة مرور جديدة</h1>

        {done ? (
          <p className="mt-6 rounded-md bg-emerald-50 p-3 text-center text-sm text-emerald-800">
            تم تحديث كلمة المرور بنجاح. جاري التحويل لتسجيل الدخول...
          </p>
        ) : !recoveryReady ? (
          <p className="mt-6 rounded-md bg-amber-50 p-3 text-center text-sm text-amber-800">
            لم نتمكن من التحقق من رابط الاسترجاع. تأكد من فتح الرابط الكامل من بريدك، أو
            <a href="/forgot-password" className="mx-1 font-semibold text-primary underline">اطلب رابطاً جديداً</a>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور الجديدة</Label>
              <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
              <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </div>
            {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</> : <><KeyRound className="ml-2 h-4 w-4" /> حفظ كلمة المرور</>}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
