// مكوّن error boundary لكل صفحة + مكوّن فرعي لحماية أقسام داخلية
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

function PageFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">حاول مرة أخرى أو ارجع للرئيسية.</p>
        <p className="mt-2 break-words text-xs text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-[color:var(--navy-light)]"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

/** يُمرَّر إلى createFileRoute({ errorComponent: PageErrorComponent }) */
export function PageErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[page-error]", error);
  return <PageFallback error={error} reset={reset} />;
}

function SectionFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">تعذّر تحميل هذا القسم</p>
      <p className="mt-1 break-words text-xs text-muted-foreground">{(error as Error)?.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 rounded-md border bg-background px-3 py-1 text-xs hover:bg-accent"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

/** لف قسم داخل صفحة حتى لا يُسقط انهياره الصفحة بأكملها */
export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary FallbackComponent={SectionFallback}>{children}</ErrorBoundary>;
}
