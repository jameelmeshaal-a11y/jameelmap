
سأنفّذ أربع دفعات بالتوازي بدون انتظار تأكيد.

## 1) ربط DynamicCityPicker في الصفحة الرئيسية

**`src/routes/index.tsx`** — استبدال `CityPicker` الثابت بالتدفّق الديناميكي الكامل:
- إزالة استيراد `resolveCities` و `CityPicker`، واستيراد `DynamicCityPicker` + `fetchCitiesForCountry`.
- ترتيب الحقول: [الدولة] → [النشاط] → زر **📍 جلب المدن** (يظهر بعد كتابة الدولة فقط) → `DynamicCityPicker` (بعد الجلب) → [الحد الأقصى: 500 / 2000 / 5000 / بلا حد] → زر 🚀 ابدأ الجمع (مُعطّل حتى تُحدَّد مدينة واحدة على الأقل).
- حالة جديدة: `cities: {name,score}[]`, `loadingCities`, `citiesError`, `cachedAt`, `maxResults` (number | null = بلا حد ⇒ 20000).
- زر "📍 جلب المدن" يستدعي `fetchCitiesForCountry({ data: { country } })` ويعرض شارة "⚡ من الكاش" إذا `cachedAt` غير null، وزرّ "🔄 جلب جديد" يستدعي نفس الـ fn مع `forceRefresh: true`.
- تمرير `maxResults` إلى `startScrape` (الحقل موجود في `StartInput`).

## 2) رفع نتائج Grid Search من ~177 إلى الآلاف

المشكلة: `GRID_SIZE=4` (16 خلية) + كلمة مفتاحية واحدة لا يكفي للمدن الكبيرة. الحل بدون كسر العمارة:

**`src/lib/places-grid.server.ts`**:
- زيادة `SATURATION` إلى **20** (Places New يرجّع 20/صفحة × 3 صفحات = 60، فالاكتفاء عند 60 يعني تشبّع — لكن استخدام 20 يكتشف التشبع أبكر ويُقسّم).  
  أبقي على 60 لكن أضيف معيار ثانٍ: قسّم إذا `nextPageToken` ظهر في الصفحة الثالثة.
- زيادة `maxDepth` من 3 إلى **5** و `MIN_CELL_METERS` إلى **400م**.
- إضافة `nearbySearchCell(category, cell)` بديلاً يستخدم `places:searchNearby` مع `locationRestriction.circle` (مركز الخلية + نصف قطر = نصف القطر القطري). يُستدعى كموجة ثانية فقط إذا الخلية أعادت ≥30 نتيجة (لتعزيز الكثيفة).

**`src/lib/scrape-engine.server.ts`**:
- `GRID_SIZE: 4 → 6` (36 خلية افتراضياً، 64 بعد التقسيم التكيّفي).
- `CELL_CONCURRENCY: 6 → 8`.
- توسيع `keywords` لأي نشاط غير مسجد: قائمة افتراضية = `[activity, `${activity} shop`, `${activity} store`]` للإنجليزي، أو إضافة الترجمة عبر خريطة بسيطة (cafe ↔ coffee shop ↔ كافيه). يُحتفظ بالنسخ الأصلية مع dedup عبر `place_id`.
- توثيق العدد المتوقّع في `current_step` (`بحث: 12/216 خلية × كلمة`).

## 3) تبييض شعار "جميل ماب / JAMEEL MAP"

**`src/components/logo.tsx`** — قبول `variant?: "default" | "onDark"`:
- `onDark`: العنوان والـ subtitle بـ `text-white` و `text-white/80`، الدائرة والـ pin بـ `stroke-white/90` و `fill-white`.
- `default`: يبقى كما هو (navy/gold) للاستخدام داخل البطاقات.

**`src/routes/index.tsx`**: تمرير `variant="onDark"` للشعار داخل الـ header.  
أي استخدام آخر للشعار على خلفية فاتحة (مثل بطاقات المكتبة) يبقى افتراضياً.

## 4) استئناف المهام المعلّقة + كسر التعليق

**Server function جديدة** في `src/lib/scraper.functions.ts`:
```
export const resumeScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(...{jobId})
  .handler(...) // يعيد set status='pending' + stopped_at=null ثم void fetch run-job
```

**`src/routes/api/public/run-job.$jobId.ts`**:
- السماح بإعادة التشغيل إذا `status ∈ {pending, running, stopped, failed}` ومرّ أكثر من **3 دقائق** على `updated_at` (تعليق). يُعاد ضبط الحالة إلى `running` ويُكمل من المدن غير المنتهية.

**`src/lib/scrape-engine.server.ts`**:
- في `runScrapeJob`، تخطّي المدن التي `status='done'` (موجودة في `scrape_job_cities`): قراءة كل المدن مع `status`, ثم `cities = rows.filter(r => r.status !== 'done').map(r => r.city)` للمعالجة، مع احتساب `citiesDone` ابتدائياً من العدد الموجود.
- إعادة ضبط أي مدينة `status='running'` إلى `pending` عند بدء الـ run (لأنها بقيت معلّقة من تشغيل سابق).
- تجميع `totalSaved` ابتدائياً من `SELECT count + sum(results_count)` للمدن المنتهية.

**`src/routes/library.tsx`**:
- زرّ **"▶️ استئناف"** يظهر لأي مهمة `status ∈ {stopped, failed, running}` حيث `updated_at` أقدم من 3 دقائق، يستدعي `resumeScrape` ثم يُحدّث الكاش.
- شارة "معلّقة" (amber) إذا `running` و آخر تحديث > 3 دقائق.

**`src/lib/library.functions.ts`**: تضمين `updated_at` في `listJobs` لحساب التعليق على الكلاينت.

## ملخّص الملفات

- يُحرَّر: `src/routes/index.tsx`, `src/components/logo.tsx`, `src/lib/places-grid.server.ts`, `src/lib/scrape-engine.server.ts`, `src/lib/scraper.functions.ts`, `src/routes/api/public/run-job.$jobId.ts`, `src/routes/library.tsx`, `src/lib/library.functions.ts`.
- لا migrations جديدة (كل الأعمدة المطلوبة موجودة: `stopped_at`, `updated_at`, `selected_cities`, `total_cities`).
- لا dependencies جديدة.
