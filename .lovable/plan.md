# خطة: نظام استقرار التطبيق

الهدف: إضافة طبقة حماية فوق الكود الحالي **دون تغيير أي منطق موجود**.

---

## 1. حماية Authentication

**`src/routes/login.tsx`**
- إبقاء رسالة الخطأ كما هي مع ترجمتها للعربية (Invalid login credentials → "البريد أو كلمة المرور غير صحيحة").
- إضافة عدّاد محاولات في `sessionStorage` (`login_attempts`): بعد 5 محاولات فاشلة، تعطيل الزر 30 ثانية مع عدّاد تنازلي.
- **حماية من redirect loop**: قبل `window.location.assign("/")`، التحقق أن المستخدم ليس قادماً من `/` بسبب redirect (فحص `sessionStorage.getItem("last_redirect_ts")` — لو أقل من ثانيتين، نعرض رسالة خطأ بدل التوجيه).

**`src/lib/auth-guards.ts`**
- إضافة حارس ضد الحلقة: قبل `throw redirect({ to: "/login" })` نزيد عدّاد `redirect_count` في `sessionStorage` خلال نافذة 5 ثوان. لو تجاوز 3، نوقف الـ redirect ونرمي خطأ يظهره الـ ErrorBoundary بدل دخول حلقة.
- لف `supabase.auth.getUser()` بـ `try/catch` + timeout 10 ثوان.

---

## 2. Error Boundaries لكل صفحة

إنشاء **`src/components/page-error-boundary.tsx`** (مكوّن قابل لإعادة الاستخدام يعرض "حدث خطأ غير متوقع" مع زر إعادة المحاولة وزر العودة للرئيسية، بنفس تصميم `ErrorComponent` الحالي).

ربطه عبر `errorComponent` على كل route:
- `src/routes/index.tsx`
- `src/routes/library.tsx`
- `src/routes/library.$jobId.tsx`
- `src/routes/admin.tsx`
- `src/routes/bootstrap.tsx`
- `src/routes/login.tsx`

كذلك لف الأقسام الداخلية الحساسة (مثل قائمة النتائج، جدول الإحصاءات) داخل `<ErrorBoundary>` من `react-error-boundary` (تثبيت الحزمة) — هكذا انهيار قسم لا يُسقط الصفحة كاملة.

الجذر `__root.tsx` يحتوي بالفعل `errorComponent` — نُبقيه ونُحسّن الرسالة فقط.

---

## 3. حماية استدعاءات API

إنشاء **`src/lib/safe-fetch.ts`**:
- `safeFetch(url, opts, { timeoutMs = 15000 })` يلف `fetch` بـ `AbortController` بمهلة 15 ثانية، ويُرجع `{ data, error }` بدل رمي.
- `withTimeout(promise, ms)` غلاف عام لأي Promise (يُستخدم مع `supabase` queries في الواجهة).

إنشاء **`src/lib/safe-query.ts`**:
- `safeRun(fn)` يلف أي callback بـ `try/catch` ويُرجع `{ ok, data, error }` ويسجّل الخطأ في console + يُظهر `toast.error("تعذّر إكمال العملية: …")` بدل تجميد الصفحة.

**لا نغيّر منطق** أي صفحة — نوفّر هذه الأدوات فقط، ونطبّقها على نقاط النداء في:
- `src/routes/index.tsx` (بدء scrape)
- `src/routes/library.tsx` و `library.$jobId.tsx` (تحميل النتائج)
- `src/routes/admin.tsx` (إدارة المستخدمين)
بإحاطة استدعاءات `useMutation`/`useQuery` بـ `onError` يعرض toast بدل تركها صامتة.

---

## 4. حماية قاعدة البيانات (طرف العميل وservers fns)

**سقف 50,000 سجل** لكل قراءة:
- إضافة ثابت `MAX_DB_ROWS = 50_000` في `src/lib/safe-query.ts`.
- في كل `supabase.from(...).select(...)` يُحتمل أن يُرجع قائمة كبيرة (`scrape_results`, `scrape_jobs`, `audit_log`) نضيف `.range(0, MAX_DB_ROWS - 1)` كحدّ أعلى أمان دون تعديل الفلاتر الحالية.
- في server functions الموجودة (`library.functions.ts`, `admin.functions.ts`) نُطبّق نفس السقف.

**عدم تعليق المهمة عند فشل كتابة**:
- في `src/lib/scrape-engine.server.ts` (وأي مكان `supabase.from(...).insert/update`)، نلف كل كتابة بـ `try/catch`؛ عند الفشل نُسجّل في `audit_log` (إن أمكن) + console.error، ونُكمل بدل رمي خطأ يُوقف الـ job.
- نضيف helper `safeWrite(label, promise)` في `src/lib/safe-query.ts` للاستخدام داخل server fns.

---

## ملخّص الملفات

```text
جديد:
  src/components/page-error-boundary.tsx
  src/lib/safe-fetch.ts
  src/lib/safe-query.ts

تعديل (طبقة حماية فقط، بدون تغيير منطق):
  src/routes/__root.tsx           // تحسين رسالة الخطأ
  src/routes/login.tsx            // محاولات + حماية loop + ترجمة خطأ
  src/routes/index.tsx            // errorComponent + onError toasts
  src/routes/library.tsx          // errorComponent + سقف 50k
  src/routes/library.$jobId.tsx   // errorComponent + سقف 50k
  src/routes/admin.tsx            // errorComponent + سقف 50k
  src/routes/bootstrap.tsx        // errorComponent
  src/lib/auth-guards.ts          // عدّاد redirect + timeout
  src/lib/scrape-engine.server.ts // safeWrite حول كل insert/update
  src/lib/library.functions.ts    // سقف 50k
  src/lib/admin.functions.ts      // سقف 50k

تثبيت:
  bun add react-error-boundary
```

## ضمانات

- **لا تغيير في منطق العمل** (لا نلمس خوارزمية الـ scrape، لا الفلاتر، لا واجهة المستخدم الوظيفية).
- كل تعديل قابل للتراجع (طبقات wrappers اختيارية).
- لا يُضاف أي retry تلقائي قد يُسبب double-charges أو loops — فقط حماية + رسائل.
