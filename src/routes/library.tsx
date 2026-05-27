import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listJobs, getAggregateStats, deleteEmptyJobs, deleteJob } from "@/lib/library.functions";
import { stopScrape, resumeScrape } from "@/lib/scraper.functions";
import { scrapeJobEmails } from "@/lib/email-scraper.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, FileText, Home, Loader2, Database, Trash2, StopCircle, LogOut, Mail, Zap, Play, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/library")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: LibraryPage,
  head: () => ({
    meta: [
      { title: "مكتبة النتائج — جميل ماب" },
      { name: "description", content: "جميع عمليات الجمع السابقة وعدد النتائج وتحميل ملفات Excel." },
    ],
  }),
});

function isStuck(j: { status?: unknown; updated_at?: unknown }): boolean {
  if (j.status !== "running" && j.status !== "pending") return false;
  const t = typeof j.updated_at === "string" ? Date.parse(j.updated_at) : 0;
  if (!t) return false;
  return Date.now() - t > 3 * 60 * 1000;
}

function LibraryPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listJobs);
  const statsFn = useServerFn(getAggregateStats);
  const stopFn = useServerFn(stopScrape);
  const resumeFn = useServerFn(resumeScrape);
  const delEmptyFn = useServerFn(deleteEmptyJobs);
  const delJobFn = useServerFn(deleteJob);
  const scrapeEmailsFn = useServerFn(scrapeJobEmails);
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fn(),
    refetchInterval: 5000,
  });
  const stats = useQuery({
    queryKey: ["aggregate-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 15000,
  });
  const stopMut = useMutation({
    mutationFn: (id: string) => stopFn({ data: { jobId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const delEmptyMut = useMutation({
    mutationFn: () => delEmptyFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const delJobMut = useMutation({
    mutationFn: (id: string) => delJobFn({ data: { jobId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const emailMut = useMutation({
    mutationFn: (id: string) => scrapeEmailsFn({ data: { jobId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const resumeMut = useMutation({
    mutationFn: async (id: string) => {
      await resumeFn({ data: { jobId: id } });
      void fetch(`/api/public/run-job/${id}`, { method: "POST" }).catch(() => {});
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const filteredJobs = data?.jobs.filter((j) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (j.activity as string).toLowerCase().includes(s) ||
           (j.country as string).toLowerCase().includes(s);
  }) ?? [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2"><Home className="h-5 w-5" /><h1 className="text-2xl font-bold">مكتبة النتائج</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => delEmptyMut.mutate()} disabled={delEmptyMut.isPending}>
              <Trash2 className="ml-1.5 h-4 w-4" /> حذف الفارغة
            </Button>
            <a href="/api/public/download-all" download className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4" /> تصدير مجمّع
            </a>
            <Link to="/"><Button variant="ghost" size="sm"><Home className="ml-2 h-4 w-4" /> الرئيسية</Button></Link>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="ml-1.5 h-4 w-4" /> خروج</Button>
          </div>
        </div>
        {stats.data && (
          <div className="container mx-auto max-w-5xl px-6 pb-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Database className="h-4 w-4" />
                إجمالي السجلات: <strong className="text-foreground">{stats.data.total.toLocaleString("en")}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
                سجلات فريدة عبر كل العمليات: <strong>{stats.data.uniquePlaces.toLocaleString("en")}</strong>
              </span>
            </div>
          </div>
        )}
      </header>

      <section className="container mx-auto max-w-5xl px-4 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التحميل...
          </div>
        )}
        {error && (
          <p className="rounded-md bg-destructive/10 p-4 text-destructive">{(error as Error).message}</p>
        )}
        {data && data.jobs.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            لا توجد عمليات جمع سابقة بعد. <Link to="/" className="font-semibold text-primary underline">ابدأ من هنا</Link>.
          </Card>
        )}

        <div className="mb-4">
          <input
            type="search"
            placeholder="بحث في المكتبة (نشاط أو دولة)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="space-y-3">
          {filteredJobs.map((j) => (
            <Card key={j.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{j.activity}</h2>
                    <span className="text-sm text-muted-foreground">— {j.country}</span>
                    <StatusBadge status={j.status as string} />
                    {j.from_cache ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Zap className="h-3 w-3" /> من الكاش
                      </span>
                    ) : null}
                    {isStuck(j) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> معلّقة
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(j.created_at as string).toLocaleString("ar")} · {j.cities_done}/{j.cities_total} مدينة
                  </p>
                  {j.error_message ? (
                    <p className="mt-1 text-xs text-amber-700">{j.error_message as string}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                    {j.results_count} نتيجة
                  </span>
                  {(j.status === "running" || j.status === "pending") && !isStuck(j) && (
                    <Button variant="destructive" size="sm" onClick={() => stopMut.mutate(j.id as string)} disabled={stopMut.isPending}>
                      <StopCircle className="ml-1.5 h-4 w-4" /> إيقاف
                    </Button>
                  )}
                  {(j.status === "stopped" || j.status === "failed" || isStuck(j)) && (
                    <Button variant="default" size="sm" onClick={() => resumeMut.mutate(j.id as string)} disabled={resumeMut.isPending}>
                      <Play className="ml-1.5 h-4 w-4" /> استئناف
                    </Button>
                  )}
                  {(j.status === "completed" || j.status === "stopped") && j.results_count > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => emailMut.mutate(j.id as string)} disabled={emailMut.isPending}>
                        {emailMut.isPending && emailMut.variables === j.id
                          ? <><Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> جلب...</>
                          : <><Mail className="ml-1.5 h-4 w-4" /> جلب الإيميلات</>}
                      </Button>
                      <a href={`/api/public/download/${j.id}`} download className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                        <Download className="h-4 w-4" /> Excel
                      </a>
                    </>
                  )}
                  <Link to="/library/$jobId" params={{ jobId: j.id as string }} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <FileText className="h-4 w-4" /> عرض <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف هذه المهمة وجميع نتائجها؟")) delJobMut.mutate(j.id as string); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending: { label: "في الانتظار", cls: "bg-muted text-muted-foreground" },
    running: { label: "قيد التشغيل", cls: "bg-blue-100 text-blue-800" },
    completed: { label: "مكتملة", cls: "bg-emerald-100 text-emerald-800" },
    stopped: { label: "موقوفة", cls: "bg-amber-100 text-amber-800" },
    failed: { label: "فشلت", cls: "bg-red-100 text-red-800" },
  };
  const c = cfg[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>;
}
