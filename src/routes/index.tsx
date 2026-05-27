import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { startScrape, getJobStatus, stopScrape } from "@/lib/scraper.functions";
import { fetchCitiesForCountry } from "@/lib/cities-fetch.functions";
import { DynamicCityPicker } from "@/components/dynamic-city-picker";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { requireBrowserUser } from "@/lib/auth-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, FolderOpen, Loader2, MapPin, Search, Sparkles, CheckCircle2, Circle, XCircle, LogOut, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: requireBrowserUser,
  component: HomePage,
  head: () => ({
    meta: [
      { title: "جميل ماب — مستخرج بيانات الأماكن" },
      { name: "description", content: "أدخل الدولة والنشاط واحصل على ملف Excel جاهز بكل الأماكن من خرائط Google." },
    ],
  }),
});

const MAX_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "500", value: 500 },
  { label: "2000", value: 2000 },
  { label: "5000", value: 5000 },
  { label: "بلا حد", value: 20000 },
];

function HomePage() {
  const [country, setCountry] = useState("");
  const [activity, setActivity] = useState("");
  const [cities, setCities] = useState<{ name: string; score: number }[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState<number>(2000);
  const [jobId, setJobId] = useState<string | null>(null);

  const startFn = useServerFn(startScrape);
  const statusFn = useServerFn(getJobStatus);
  const stopFn = useServerFn(stopScrape);
  const fetchCitiesFn = useServerFn(fetchCitiesForCountry);
  const stopMut = useMutation({ mutationFn: (id: string) => stopFn({ data: { jobId: id } }) });

  const citiesMut = useMutation({
    mutationFn: (vars: { force: boolean }) =>
      fetchCitiesFn({ data: { country: country.trim(), forceRefresh: vars.force } }),
    onSuccess: (res) => {
      if (res.error) { setCitiesError(res.error); setCities([]); setSelectedCities([]); setCachedAt(null); return; }
      setCitiesError(null);
      setCities(res.cities);
      setCachedAt(res.cachedAt ?? null);
      // افتراضياً: حدّد أول 10
      setSelectedCities(res.cities.slice(0, 10).map((c) => c.name));
    },
    onError: (e) => { setCitiesError((e as Error).message); setCities([]); setSelectedCities([]); },
  });

  const startMut = useMutation({
    mutationFn: async (vars: { country: string; activity: string; cities: string[]; maxResults: number }) => {
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
      return s === "completed" || s === "failed" || s === "stopped" ? false : 2500;
    },
  });

  const isRunning = jobId && status.data && status.data.status !== "completed" && status.data.status !== "failed" && status.data.status !== "stopped";
  const isDone = status.data?.status === "completed";
  const isFailed = status.data?.status === "failed";

  const handleCountryChange = (val: string) => {
    setCountry(val);
    setCities([]); setSelectedCities([]); setCachedAt(null); setCitiesError(null);
  };

  const canStart = country.trim() && activity.trim() && selectedCities.length > 0 && !isRunning;

  return (
    <main className="min-h-screen bg-background">
      <header className="relative overflow-hidden text-white" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-6 pt-6 pb-28">
          <div className="flex items-center justify-between gap-3">
            <Logo size={36} variant="onDark" />
            <div className="flex flex-wrap items-center gap-2">
              <AdminLink />
              <Link to="/library" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25">
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
            <h1 className="mt-5 text-5xl font-bold tracking-tight text-white">جميل ماب</h1>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/90">
              اختر الدولة والنشاط، اجلب المدن، ثم نجمع لك كل الأماكن من خرائط Google ونصدّرها كملف Excel.
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
                cities: selectedCities,
                maxResults,
              });
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-semibold">الدولة</Label>
              <Input id="country" placeholder="USA, السعودية, مصر, تركيا..." value={country}
                onChange={(e) => handleCountryChange(e.target.value)} disabled={!!isRunning} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity" className="text-sm font-semibold">النشاط / الكلمة المفتاحية</Label>
              <Input id="activity" placeholder="coffee, مطعم, صيدلية, فندق..." value={activity}
                onChange={(e) => setActivity(e.target.value)} disabled={!!isRunning} required />
            </div>

            {country.trim() && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => citiesMut.mutate({ force: false })} disabled={citiesMut.isPending || !!isRunning}>
                  {citiesMut.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الجلب...</> : <><MapPin className="ml-2 h-4 w-4" /> 📍 جلب المدن</>}
                </Button>
                {cachedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Zap className="h-3 w-3" /> من الكاش
                  </span>
                )}
                {cities.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => citiesMut.mutate({ force: true })} disabled={citiesMut.isPending || !!isRunning}>
                    🔄 جلب جديد
                  </Button>
                )}
                {citiesError && <span className="text-xs text-destructive">{citiesError}</span>}
              </div>
            )}

            {(citiesMut.isPending || cities.length > 0) && (
              <DynamicCityPicker
                cities={cities}
                selected={selectedCities}
                onChange={setSelectedCities}
                loading={citiesMut.isPending}
                disabled={!!isRunning}
              />
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">الحد الأقصى للنتائج</Label>
              <div className="flex flex-wrap gap-2">
                {MAX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMaxResults(opt.value)}
                    disabled={!!isRunning}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      maxResults === opt.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={!canStart || startMut.isPending} className="w-full" size="lg">
              {startMut.isPending ? <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التهيئة...</>
                : isRunning ? <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري الجمع...</>
                : <><Search className="ml-2 h-5 w-5" /> 🚀 ابدأ الجمع</>}
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
                {status.data.status === "stopped" && "موقوفة ⏸"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>المدن: {status.data.citiesDone} / {status.data.citiesTotal}</span>
              <span className="font-semibold text-primary">تم جمع {status.data.resultsCount} نتيجة فريدة</span>
              {status.data.currentCity && !isDone && (
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {status.data.currentCity}</span>
              )}
              {isRunning && (
                <Button size="sm" variant="destructive" onClick={() => stopMut.mutate(jobId!)} disabled={stopMut.isPending}>
                  إيقاف
                </Button>
              )}
              {(status.data.status === "stopped" || status.data.status === "failed") && (
                <Button size="sm" onClick={() => { void fetch(`/api/public/run-job/${jobId}`, { method: "POST" }).catch(() => {}); status.refetch(); }}>
                  استئناف
                </Button>
              )}
            </div>

            {status.data.cities.length > 0 && (
              <div className="mt-5 max-h-96 space-y-2 overflow-y-auto rounded-md border bg-card/50 p-3">
                {status.data.cities.map((c) => (
                  <div key={c.city} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        {c.status === "done" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          : c.status === "running" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                          : c.status === "failed" ? <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                          : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate font-medium">{c.city}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.results_count} نتيجة · {c.progress}%</span>
                    </div>
                    <Progress value={c.progress} className="h-1.5" />
                    {c.current_step && <p className="truncate text-xs text-muted-foreground">{c.current_step}</p>}
                    {c.error_message && <p className="truncate text-xs text-destructive">{c.error_message}</p>}
                  </div>
                ))}
              </div>
            )}

            {isFailed && (
              <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {status.data.errorMessage || "حدث خطأ غير معروف"}
              </p>
            )}

            {(isDone || status.data.status === "stopped") && status.data.resultsCount > 0 && (
              <a href={`/api/public/download/${jobId}`} download
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Download className="h-5 w-5" /> تحميل ملف Excel ({status.data.resultsCount} نتيجة)
              </a>
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
