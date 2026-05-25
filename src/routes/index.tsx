import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { startScrape, getJobStatus } from "@/lib/scraper.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, MapPin, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "عالم جميل — مستخرج بيانات الأماكن" },
      { name: "description", content: "أدخل الدولة والنشاط واحصل على ملف Excel جاهز بكل الأماكن من خرائط Google." },
    ],
  }),
});

function HomePage() {
  const [country, setCountry] = useState("");
  const [activity, setActivity] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const startFn = useServerFn(startScrape);
  const statusFn = useServerFn(getJobStatus);

  const startMut = useMutation({
    mutationFn: async (vars: { country: string; activity: string }) => {
      const res = await startFn({ data: vars });
      // أطلق المهمة فعلياً عبر مسار يبقى الاتصال مفتوحاً حتى الانتهاء
      // لا ننتظر — المتصفح يحافظ على Worker حياً تلقائياً
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
      return s === "completed" || s === "failed" ? false : 2000;
    },
  });

  const isRunning = jobId && status.data && status.data.status !== "completed" && status.data.status !== "failed";
  const isDone = status.data?.status === "completed";
  const isFailed = status.data?.status === "failed";
  const progress = status.data && status.data.citiesTotal > 0
    ? Math.round((status.data.citiesDone / status.data.citiesTotal) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-background">
      <header
        className="relative overflow-hidden text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="container mx-auto px-6 pt-14 pb-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
            <Sparkles className="h-4 w-4" />
            <span>منصة استخراج بيانات الأماكن</span>
          </div>
          <h1 className="mt-5 text-5xl font-bold tracking-tight">عالم جميل</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/90">
            أدخل الدولة والنشاط، نجمع لك كل البيانات من خرائط Google ونصدّرها كملف Excel جاهز.
          </p>
        </div>
      </header>

      <section className="container mx-auto mt-8 max-w-3xl px-4 pb-16">
        <Card className="p-6 shadow-[var(--shadow-elegant)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!country.trim() || !activity.trim()) return;
              setJobId(null);
              startMut.mutate({ country: country.trim(), activity: activity.trim() });
            }}
            className="grid gap-5 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-semibold">الدولة</Label>
              <Input
                id="country"
                placeholder="مثال: USA، السعودية، مصر، تركيا"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
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
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!!isRunning || startMut.isPending} className="w-full" size="lg">
                {startMut.isPending ? (
                  <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التهيئة...</>
                ) : isRunning ? (
                  <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري الجمع...</>
                ) : (
                  <><Search className="ml-2 h-5 w-5" /> ابدأ الجمع</>
                )}
              </Button>
            </div>
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

            <div className="mt-4 space-y-3">
              <Progress value={progress} />
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {status.data.currentCity || (isDone ? "انتهى" : "—")}
                </span>
                <span>المدن: {status.data.citiesDone} / {status.data.citiesTotal}</span>
                <span className="font-semibold text-primary">النتائج: {status.data.resultsCount}</span>
              </div>
            </div>

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
