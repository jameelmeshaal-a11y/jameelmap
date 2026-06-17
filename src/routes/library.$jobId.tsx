import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getJobDetail, runDedup, getJobCities, retryFailedCities } from "@/lib/library.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Download, Facebook, Globe, Instagram, Loader2, MapPin,
  Phone, RefreshCw, Search, Sparkles, Trash2, Twitter, Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { requireBrowserUser } from "@/lib/auth-guards";
import { PageErrorComponent } from "@/components/page-error-boundary";

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">الوظيفة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">قد تكون حُذفت أو أن الرابط غير صحيح.</p>
        <Link to="/library" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">العودة للمكتبة</Link>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/library/$jobId")({
  beforeLoad: requireBrowserUser,
  component: JobDetailPage,
  errorComponent: PageErrorComponent,
  notFoundComponent: NotFound,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getJobDetail);
  const dedupFn = useServerFn(runDedup);
  const citiesFn = useServerFn(getJobCities);
  const retryFn = useServerFn(retryFailedCities);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [reMsg, setReMsg] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["job-detail", jobId, submitted],
    queryFn: () => detailFn({ data: { jobId, search: submitted || undefined } }),
  });

  const citiesQ = useQuery({
    queryKey: ["job-cities", jobId],
    queryFn: () => citiesFn({ data: { jobId } }),
    refetchInterval: 8000,
  });

  const retryMut = useMutation({
    mutationFn: () => retryFn({ data: { jobId } }),
    onSuccess: async (r) => {
      toast.success(`أُعيد فتح ${r.reset} مدينة فاشلة — جاري الاستئناف...`);
      // ابدأ الـ runner مرة أخرى
      void fetch(`/api/public/run-job/${jobId}`, { method: "POST" }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["job-cities", jobId] });
      qc.invalidateQueries({ queryKey: ["job-detail", jobId] });
    },
    onError: (e: Error) => toast.error(`تعذّر إعادة المحاولة: ${e.message}`),
  });

  const dedupMut = useMutation({
    mutationFn: () => dedupFn({ data: { jobId } }),
    onSuccess: (r) => {
      setReMsg(`تم حذف ${r.removed} نتيجة مكررة. المتبقي: ${r.kept}`);
      qc.invalidateQueries({ queryKey: ["job-detail", jobId] });
    },
  });

  const reEnrichMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/reenrich/${jobId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ updated: number; total: number }>;
    },
    onSuccess: (r) => {
      setReMsg(`تم استخراج بيانات تواصل لـ ${r.updated} من ${r.total} موقع`);
      qc.invalidateQueries({ queryKey: ["job-detail", jobId] });
    },
    onError: (e) => setReMsg(`فشل: ${(e as Error).message}`),
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/library" className="text-sm text-muted-foreground hover:text-foreground">
              ← المكتبة
            </Link>
            <h1 className="text-xl font-bold">
              {data?.job ? `${data.job.activity} — ${data.job.country}` : "جاري التحميل..."}
            </h1>
          </div>
          {data?.job?.status === "completed" && (
            <a
              href={`/api/public/download/${jobId}`}
              download
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> تحميل Excel
            </a>
          )}
        </div>
      </header>

      <section className="container mx-auto max-w-7xl px-4 py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التحميل...
          </div>
        )}
        {error && <p className="rounded-md bg-destructive/10 p-4 text-destructive">{(error as Error).message}</p>}

        {data && (
          <>
            {/* إحصاءات + أدوات */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="إجمالي" value={data.stats.total} />
              <Stat label="بهاتف" value={data.stats.withPhone} />
              <Stat label="بموقع" value={data.stats.withWebsite} />
              <Stat label="بإيميل" value={data.stats.withEmail} highlight />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => { e.preventDefault(); setSubmitted(search); }}
                className="flex flex-1 items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، المدينة، العنوان، أو الإيميل..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <Button type="submit" variant="secondary">بحث</Button>
                {submitted && (
                  <Button type="button" variant="ghost" onClick={() => { setSearch(""); setSubmitted(""); }}>
                    مسح
                  </Button>
                )}
              </form>

              <Button
                onClick={() => reEnrichMut.mutate()}
                disabled={reEnrichMut.isPending}
                variant="outline"
              >
                {reEnrichMut.isPending
                  ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإثراء (قد يستغرق دقائق)...</>
                  : <><Sparkles className="ml-2 h-4 w-4" /> استخرج الإيميلات الآن</>}
              </Button>
              <Button
                onClick={() => dedupMut.mutate()}
                disabled={dedupMut.isPending}
                variant="outline"
              >
                {dedupMut.isPending
                  ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحذف...</>
                  : <><Trash2 className="ml-2 h-4 w-4" /> احذف المكرر</>}
              </Button>
            </div>

            {reMsg && (
              <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{reMsg}</p>
            )}

            {/* لوحة المدن الفاشلة */}
            {citiesQ.data && citiesQ.data.failed.length > 0 && (
              <Card className="mb-4 border-amber-200 bg-amber-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900">
                        {citiesQ.data.failed.length} مدينة فشلت أثناء الجمع
                      </h3>
                      <p className="mt-0.5 text-xs text-amber-800">
                        يمكنك إعادة المحاولة لهذه المدن فقط دون إعادة تشغيل العملية كاملة.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => retryMut.mutate()}
                    disabled={retryMut.isPending}
                    className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {retryMut.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري...</>
                      : <><RefreshCw className="h-4 w-4" /> إعادة محاولة المدن الفاشلة</>}
                  </Button>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {citiesQ.data.failed.map((c) => (
                    <li key={c.city as string} className="rounded-md bg-white/60 px-2 py-1.5 text-xs">
                      <span className="font-medium text-foreground">{c.city as string}</span>
                      {c.error_message ? (
                        <span className="block text-[11px] text-amber-800">{c.error_message as string}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* جدول */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase">
                    <tr>
                      <th className="p-3 text-right font-semibold">الاسم</th>
                      <th className="p-3 text-right font-semibold">المدينة</th>
                      <th className="p-3 text-right font-semibold">الهاتف</th>
                      <th className="p-3 text-right font-semibold">الإيميل</th>
                      <th className="p-3 text-right font-semibold">روابط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id as string} className="border-t hover:bg-accent/30">
                        <td className="p-3 align-top">
                          <div className="font-medium">{r.name as string}</div>
                          {r.address ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">{r.address as string}</div>
                          ) : null}
                        </td>
                        <td className="p-3 align-top text-muted-foreground">
                          {r.city as string}
                          {r.state ? <span className="text-xs"> ({r.state as string})</span> : null}
                        </td>
                        <td className="p-3 align-top" dir="ltr">
                          {r.phone ? (
                            <a href={`tel:${r.phone}`} className="text-primary hover:underline">{r.phone as string}</a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 align-top">
                          {r.email ? (
                            <a href={`mailto:${r.email}`} className="break-all text-primary hover:underline" dir="ltr">
                              {r.email as string}
                            </a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <IconLink url={r.maps_url as string} title="خرائط جوجل"><MapPin className="h-4 w-4" /></IconLink>
                            <IconLink url={r.website as string} title="الموقع"><Globe className="h-4 w-4" /></IconLink>
                            <IconLink url={r.facebook as string} title="فيسبوك"><Facebook className="h-4 w-4" /></IconLink>
                            <IconLink url={r.instagram as string} title="إنستقرام"><Instagram className="h-4 w-4" /></IconLink>
                            <IconLink url={r.twitter as string} title="X"><Twitter className="h-4 w-4" /></IconLink>
                            <IconLink url={r.youtube as string} title="يوتيوب"><Youtube className="h-4 w-4" /></IconLink>
                            <IconLink url={r.tiktok as string} title="تيك توك"><span className="text-xs font-bold">TT</span></IconLink>
                            <IconLink url={r.snapchat as string} title="سناب شات"><span className="text-xs font-bold">SC</span></IconLink>
                            {r.whatsapp ? (
                              <a
                                href={`https://wa.me/${(r.whatsapp as string).replace(/[^\d]/g, "")}`}
                                target="_blank" rel="noopener noreferrer"
                                title="واتساب"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.rows.length === 0 && (
                      <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد نتائج مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {data.stats.total > data.rows.length && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                عرض {data.rows.length} من أصل {data.stats.total}. حمّل Excel لرؤية الجميع.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={`p-3 text-center ${highlight ? "bg-primary/10" : ""}`}>
      <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value.toLocaleString("en")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function IconLink({ url, title, children }: { url: string; title: string; children: React.ReactNode }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </a>
  );
}
