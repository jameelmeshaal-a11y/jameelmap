import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobs, getAggregateStats, deleteEmptyJobs, deleteJob } from "@/lib/library.functions";
import { stopScrape } from "@/lib/scraper.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, FileText, Home, Loader2, Database, Trash2, StopCircle, LogOut } from "lucide-react";

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

function LibraryPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listJobs);
  const statsFn = useServerFn(getAggregateStats);
  const stopFn = useServerFn(stopScrape);
  const delEmptyFn = useServerFn(deleteEmptyJobs);
  const delJobFn = useServerFn(deleteJob);
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
  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

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

        <div className="space-y-3">
          {data?.jobs.map((j) => (
            <Card key={j.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{j.activity}</h2>
                    <span className="text-sm text-muted-foreground">— {j.country}</span>
                    <StatusBadge status={j.status as string} />
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
                  {(j.status === "running" || j.status === "pending") && (
                    <Button variant="destructive" size="sm" onClick={() => stopMut.mutate(j.id as string)} disabled={stopMut.isPending}>
                      <StopCircle className="ml-1.5 h-4 w-4" /> إيقاف
                    </Button>
                  )}
                  {(j.status === "completed" || j.status === "stopped") && j.results_count > 0 && (
                    <a href={`/api/public/download/${j.id}`} download className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                      <Download className="h-4 w-4" /> Excel
                    </a>
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
    failed: { label: "فشلت", cls: "bg-red-100 text-red-800" },
  };
  const c = cfg[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>;
}
