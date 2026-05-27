import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "تسجيل الدخول — جميل ماب" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // تحميل صلب للصفحة بعد الدخول لضمان جاهزية الجلسة وتفادي إلغاء الانتقال من قبل onAuthStateChange
    window.location.assign("/");
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
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
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
