import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPlans } from "@/lib/billing.functions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { PageErrorComponent } from "@/components/page-error-boundary";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  errorComponent: PageErrorComponent,
  head: () => ({
    meta: [
      { title: "الباقات والأسعار — جميل ماب" },
      { name: "description", content: "اختر الباقة المناسبة لاحتياجك من جميل ماب: مجاني، احترافي، أو مؤسسي." },
      { property: "og:title", content: "الباقات — جميل ماب" },
      { property: "og:description", content: "باقات مرنة لاستخراج بيانات الأماكن من Google Maps." },
    ],
  }),
});

function PricingPage() {
  const fetchPlans = useServerFn(listPlans);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/"><Logo /></Link>
          <nav className="flex gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">الرئيسية</Link>
            <Link to="/library" className="text-sm text-muted-foreground hover:text-foreground">المكتبة</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">الباقات والأسعار</h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            اختر الباقة التي تناسب حجم عملك. يمكنك الترقية أو الإلغاء في أي وقت.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {plans.map((p, idx) => {
              const highlight = idx === 1;
              const features = (p.features as unknown as string[]) ?? [];
              return (
                <Card
                  key={p.id}
                  className={`p-6 flex flex-col ${highlight ? "border-primary ring-2 ring-primary/20" : ""}`}
                >
                  {highlight && (
                    <div className="flex items-center gap-1 text-xs font-medium text-primary mb-2">
                      <Sparkles className="h-3.5 w-3.5" /> الأكثر شيوعاً
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-foreground">{p.name_ar}</h2>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{p.price_sar === 0 ? "مجاناً" : p.price_sar}</span>
                    {p.price_sar > 0 && <span className="text-muted-foreground"> ر.س / شهرياً</span>}
                  </div>
                  <ul className="mt-6 space-y-2 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={highlight ? "default" : "outline"}
                    onClick={() => {
                      if (p.id === "free") toast.success("أنت على الباقة المجانية افتراضياً.");
                      else if (p.id === "enterprise") toast.info("للتواصل: ceo@salasah.sa");
                      else toast.info("بوابة الدفع قيد التفعيل. سيتم التواصل معك قريباً.");
                    }}
                  >
                    {p.price_sar === 0 ? "ابدأ مجاناً" : p.id === "enterprise" ? "تواصل معنا" : "اشترك الآن"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة. بوابة الدفع قيد التكامل.
        </p>
      </main>
    </div>
  );
}
