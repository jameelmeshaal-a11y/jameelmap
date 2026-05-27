import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { bootstrapFirstAdmin, checkAdminExists } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Loader2, ShieldCheck } from "lucide-react";

import { PageErrorComponent } from "@/components/page-error-boundary";

export const Route = createFileRoute("/bootstrap")({
  component: BootstrapPage,
  errorComponent: PageErrorComponent,
  head: () => ({ meta: [{ title: "تهيئة المسؤول — جميل ماب" }] }),
});

function BootstrapPage() {
  
  const checkFn = useServerFn(checkAdminExists);
  const bootFn = useServerFn(bootstrapFirstAdmin);
  const [email, setEmail] = useState("ceo@salasah.sa");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const check = useQuery({ queryKey: ["admin-exists"], queryFn: () => checkFn() });

  const mut = useMutation({
    mutationFn: async () => bootFn({ data: { email, password } }),
    onSuccess: async () => {
      await supabase.auth.signInWithPassword({ email, password });
      setDone(true);
      setTimeout(() => window.location.assign("/"), 1200);
    },
  });

  if (check.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="ml-2 h-5 w-5 animate-spin" /> فحص الحالة...
      </main>
    );
  }

  if (check.data?.hasAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-lg font-bold">يوجد مسؤول مسجّل بالفعل</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            لا يمكن استخدام صفحة التهيئة. يرجى تسجيل الدخول بدلاً من ذلك.
          </p>
          <Link to="/login">
            <Button className="mt-4" size="lg">الذهاب لتسجيل الدخول</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex justify-center"><Logo size={48} /></div>
        <h1 className="text-center text-xl font-bold">تهيئة أول مسؤول</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          هذه الصفحة تعمل مرة واحدة فقط. أنشئ حساب المسؤول الأول للنظام.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="mt-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور (8 أحرف فأكثر)</Label>
            <Input id="password" type="password" dir="ltr" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {mut.error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{(mut.error as Error).message}</p>}
          {done && <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">تم بنجاح — جاري التوجيه...</p>}
          <Button type="submit" disabled={mut.isPending || done} className="w-full" size="lg">
            {mut.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري...</> : <><ShieldCheck className="ml-2 h-4 w-4" /> إنشاء حساب المسؤول</>}
          </Button>
        </form>
      </Card>
    </main>
  );
}
