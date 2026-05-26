import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/library.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, FileText, Home, Loader2 } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
  head: () => ({
    meta: [
      { title: "مكتبة النتائج — عالم جميل" },
      { name: "description", content: "جميع عمليات الجمع السابقة وعدد النتائج وتحميل ملفات Excel." },
    ],
  }),
});

function LibraryPage() {
  const fn = useServerFn(listJobs);
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fn(),
    refetchInterval: 5000,
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold">مكتبة النتائج</h1>
          <Link to="/">
            <Button variant="ghost" size="sm"><Home className="ml-2 h-4 w-4" /> الرئيسية</Button>
          </Link>
        </div>
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
                  {j.status === "completed" && j.results_count > 0 && (
                    <a
                      href={`/api/public/download/${j.id}`}
                      download
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                    >
                      <Download className="h-4 w-4" /> Excel
                    </a>
                  )}
                  <Link
                    to="/library/$jobId"
                    params={{ jobId: j.id as string }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <FileText className="h-4 w-4" /> عرض <ArrowRight className="h-4 w-4" />
                  </Link>
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
