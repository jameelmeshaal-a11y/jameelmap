import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { startScrape, getJobStatus, stopScrape } from "@/lib/scraper.functions";
import { resolveCities } from "@/lib/country-cities";
import { CityPicker } from "@/components/city-picker";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FolderOpen, Loader2, MapPin, Search, Sparkles, CheckCircle2, Circle, XCircle, StopCircle, LogOut } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: HomePage,
  head: () => ({
    meta: [
      { title: "جميل ماب — مستخرج بيانات الأماكن" },
      { name: "description", content: "أدخل الدولة والنشاط واحصل على ملف Excel جاهز بكل الأماكن من خرائط Google." },
    ],
  }),
});

function HomePage() {
  const [country, setCountry] = useState("");
  const [activity, setActivity] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const startFn = useServerFn(startScrape);
  const statusFn = useServerFn(getJobStatus);
  const stopFn = useServerFn(stopScrape);
  const stopMut = useMutation({ mutationFn: (id: string) => stopFn({ data: { jobId: id } }) });

  // قائمة المدن المتاحة للدولة المُدخلة
  const availableCities = useMemo(() => {
    if (!country.trim()) return [] as string[];
    return resolveCities(country.trim()).cities;
  }, [country]);

  // عند تغيير الدولة: حدّد الكل افتراضياً (للدول المعروفة فقط)
  const handleCountryChange = (val: string) => {
    setCountry(val);
    const cities = resolveCities(val.trim()).cities;
    // إن كانت الدولة معروفة (>1 مدينة) — حدّد الكل، وإلا فارغ ليُكتب يدوياً
    setSelectedCities(cities.length > 1 ? cities : []);
  };

  const startMut = useMutation({
    mutationFn: async (vars: { country: string; activity: string; cities: string[] }) => {
      const res = await startFn({ data: vars });
      void fetch(`/api/public/run-job/${res.jobId}`, { method: "POST" }).catch(() => {});
      return res;
    },
    onSuccess: (res) => setJobId(res.jobId),
  });

  const status = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => statusFn({ data: { jobId: jobId! } }),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "completed" || s === "failed" ? false : 2500;
    },
  });

  const isRunning = jobId && status.data && status.data.status !== "completed" && status.data.status !== "failed";
  const isDone = status.data?.status === "completed";
  const isFailed = status.data?.status === "failed";

  const canStart =
    country.trim() &&
    activity.trim() &&
    (availableCities.length === 0 ? true : selectedCities.length > 0);

  return (
    <main className="min-h-screen bg-background">
      <header
        className="relative overflow-hidden text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="container mx-auto px-6 pt-6 pb-28">
          <div className="flex items-center justify-between gap-3">
            <Logo size={36} />
            <div className="flex flex-wrap items-center gap-2">
              <AdminLink />
              <Link
                to="/library"
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25"
              >
                <FolderOpen className="h-4 w-4" /> المكتبة
              </Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25"
              >
                <LogOut className="h-4 w-4" /> خروج
              </button>
            </div>
          </div>
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
              <Sparkles className="h-4 w-4" />
              <span>منصة استخراج بيانات الأماكن</span>
            </div>
            <h1 className="mt-5 text-5xl font-bold tracking-tight">جميل ماب</h1>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/90">
              اختر الدولة والمدن والنشاط، نجمع لك كل الأماكن من خرائط Google ونصدّرها كملف Excel جاهز.
            </p>
          </div>
        </div>
      </header>

      <section className="container mx-auto mt-8 max-w-3xl px-4 pb-16">
        <Card className="p-6 shadow-[var(--shadow-elegant)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canStart) return;
              setJobId(null);
              startMut.mutate({
                country: country.trim(),
                activity: activity.trim(),
                cities: availableCities.length > 0 ? selectedCities : [country.trim()],
              });
            }}
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-semibold">الدولة</Label>
                <Input
                  id="country"
                  placeholder="مثال: USA، السعودية، مصر، تركيا"
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={!!isRunning}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity" className="text-sm font-semibold">النشاط</Label>
                <Input
                  id="activity"
                  placeholder="مثال: Mosque، مطعم، صيدلية، فندق"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  disabled={!!isRunning}
                  required
                />
              </div>
            </div>

            {availableCities.length > 0 && (
              <CityPicker
                cities={availableCities}
                selected={selectedCities}
                onChange={setSelectedCities}
                disabled={!!isRunning}
              />
            )}

            <Button
              type="submit"
              disabled={!canStart || !!isRunning || startMut.isPending}
              className="w-full"
              size="lg"
            >
              {startMut.isPending ? (
                <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التهيئة...</>
              ) : isRunning ? (
                <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري الجمع...</>
              ) : (
                <><Search className="ml-2 h-5 w-5" /> ابدأ الجمع</>
              )}
            </Button>
          </form>

          {startMut.isError && (
            <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              فشل بدء المهمة: {(startMut.error as Error).message}
            </p>
          )}
        </Card>

        {jobId && status.data && (
          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">حالة المهمة</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                {status.data.status === "pending" && "في الانتظار"}
                {status.data.status === "running" && "قيد التشغيل"}
                {status.data.status === "completed" && "مكتملة ✅"}
                {status.data.status === "failed" && "فشلت ❌"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>المدن: {status.data.citiesDone} / {status.data.citiesTotal}</span>
              <span className="font-semibold text-primary">
                تم جمع {status.data.resultsCount} نتيجة فريدة
              </span>
              {status.data.currentCity && !isDone && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {status.data.currentCity}
                </span>
              )}
            </div>

            {/* شريط تقدم لكل مدينة */}
            {status.data.cities.length > 0 && (
              <div className="mt-5 max-h-96 space-y-2 overflow-y-auto rounded-md border bg-card/50 p-3">
                {status.data.cities.map((c) => (
                  <div key={c.city} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        {c.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : c.status === "running" ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        ) : c.status === "failed" ? (
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">{c.city}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.results_count} نتيجة · {c.progress}%
                      </span>
                    </div>
                    <Progress value={c.progress} className="h-1.5" />
                    {c.current_step && (
                      <p className="truncate text-xs text-muted-foreground">{c.current_step}</p>
                    )}
                    {c.error_message && (
                      <p className="truncate text-xs text-destructive">{c.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isFailed && (
              <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {status.data.errorMessage || "حدث خطأ غير معروف"}
              </p>
            )}

            {isDone && status.data.resultsCount > 0 && (
              <a
                href={`/api/public/download/${jobId}`}
                download
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-5 w-5" />
                تحميل ملف Excel ({status.data.resultsCount} نتيجة)
              </a>
            )}

            {status.data.preview.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="p-2 text-right font-semibold">الاسم</th>
                      <th className="p-2 text-right font-semibold">المدينة</th>
                      <th className="p-2 text-right font-semibold">الهاتف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.data.preview.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-muted-foreground">{r.city}</td>
                        <td className="p-2 text-muted-foreground" dir="ltr">{r.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {status.data.resultsCount > status.data.preview.length && (
                  <p className="bg-secondary/30 p-2 text-center text-xs text-muted-foreground">
                    عرض أحدث {status.data.preview.length} من أصل {status.data.resultsCount} — التحميل يشمل الجميع.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          مدعوم بـ Google Maps Platform · يعمل على جميع المتصفحات
        </p>
      </section>
    </main>
  );
}

function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);
  useMemo(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (data?.role === "admin") setIsAdmin(true);
    })();
  }, []);
  if (!isAdmin) return null;
  return (
    <Link to="/admin" className="inline-flex items-center gap-2 rounded-full bg-accent/90 px-4 py-2 text-sm font-semibold text-accent-foreground backdrop-blur transition-colors hover:bg-accent">
      <Sparkles className="h-4 w-4" /> الإدارة
    </Link>
  );
}
