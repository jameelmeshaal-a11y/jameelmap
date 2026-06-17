import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Loader2, Mail, ArrowRight } from "lucide-react";
import { PageErrorComponent } from "@/components/page-error-boundary";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  errorComponent: PageErrorComponent,
  head: () => ({ meta: [{ title: "استعادة كلمة المرور — جميل ماب" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        setError(error.message || "تعذّر إرسال رابط إعادة التعيين");
        return;
      }
      setSent(true);
    } catch (err) {
      setLoading(false);
      setError((err as Error)?.message ?? "حدث خطأ غير متوقع");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex justify-center"><Logo size={48} /></div>
        <h1 className="text-center text-xl font-bold text-foreground">استعادة كلمة المرور</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          أدخل بريدك وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              تم إرسال رابط إعادة التعيين إلى <strong dir="ltr">{email}</strong>. تحقّق من بريدك (وفولدر الـ Spam).
            </p>
            <Link to="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإرسال...</> : <><Mail className="ml-2 h-4 w-4" /> إرسال الرابط</>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              تذكّرت كلمة المرور؟ <Link to="/login" className="font-semibold text-primary hover:underline">سجّل الدخول</Link>
            </p>
          </form>
        )}
      </Card>
    </main>
  );
}
