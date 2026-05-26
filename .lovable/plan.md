# خطة التطوير — جميل ماب (محدّثة)

## 1) إعادة التسمية إلى "جميل ماب"
- استبدال "عالم جميل" في `index.tsx`, `library.tsx`, `library.$jobId.tsx`, `__root.tsx`، واسم ملف Excel.

## 2) اختيار مدن متعددة (Frontend)
- مكوّن `CityPicker` في `src/components/city-picker.tsx`:
  - حقل بحث للفلترة الفورية.
  - أزرار "تحديد الكل" / "إلغاء الكل".
  - Checkbox لكل مدينة من `COUNTRY_CITIES[country]`.
  - شارة "محدد: N مدن"، الافتراضي: الكل محدد.
- منع الإرسال بدون مدينة واحدة على الأقل.

## 3) تمرير المدن المحددة
- `startScrape` يقبل `cities: string[]` (zod، 1–200).
- `scrape-engine` يستخدم القائمة الممرَّرة بدل `resolveCities`.

## 4) شريط تقدم لكل مدينة (يتطلب جدول صغير)
لا يمكن عرض % دقيقة لكل مدينة بدون تخزين حالتها. أقترح جدول صغير:

```
public.scrape_job_cities (
  id uuid pk, job_id uuid, city text, status text,
  results_count int default 0, progress int default 0,
  current_step text default '', error text default '',
  created_at, updated_at
)
```
مع GRANT للـ anon/authenticated/service_role وRLS (public read/insert/update مثل بقية الجداول).

- `getJobStatus` يُعيد إضافياً `cities: [{city, status, progress, results_count, current_step}]`.
- واجهة Job في `index.tsx` تعرض Progress bar لكل مدينة محددة مع عداد نتائجها، بدلاً من progress واحد عام.
- عداد عام: "تم جمع X نتيجة من Y مدينة (Z قيد التشغيل)".

## 5) التغطية الشاملة لكل المتاجر — أسرع وأشمل
المشكلة: Places API (New) `searchText` يُعيد حداً أقصى **60 نتيجة** لكل استعلام (3 صفحات × 20 عبر `nextPageToken`). للحصول على **كل المتاجر** في مدينة كبيرة (نيويورك، لوس أنجلوس…) نحتاج **استراتيجية متعددة الطبقات**:

### الطبقة A — تقسيم شبكي جغرافي (Grid Tiling) — الأقوى
1. **Geocode المدينة مرة واحدة** عبر `maps/api/geocode/json` للحصول على `viewport` (BBox).
2. **تقسيم BBox إلى شبكة خلايا** (مثلاً 4×4 = 16 خلية، أو تكيّفياً حسب مساحة المدينة).
3. لكل خلية: استدعاء **`places:searchNearby`** بنصف قطر يغطي الخلية + النشاط (`includedTypes` أو `textQuery` للخلية).
   - بديل أقوى: `searchText` مع `locationBias=circle{center,radius}` لكل خلية + 3 صفحات pagination.
4. **التقسيم التكيّفي**: إذا أعادت خلية 60 نتيجة (مشبعة) → قسّمها لـ 4 خلايا أصغر تلقائياً وأعد الطلب (recursive subdivide حتى ≤59 نتيجة، بحد أدنى لنصف القطر مثلاً 300م).
5. dedup الفوري بـ `place_id` بين كل الخلايا.

النتيجة: تغطية ~كاملة لكل المدينة (المساجد، المطاعم، أي نشاط) بدلاً من 60 نتيجة فقط.

### الطبقة B — تنويع الكلمات المفتاحية
- للمساجد: نُبقي `MOSQUE_KEYWORDS` (موجودة).
- لأي نشاط آخر: استخدام `includedTypes` المناسب من Places (مثلاً `restaurant`, `pharmacy`, `mosque`, `hotel`) + `textQuery` بالنشاط المُدخَل بالعربي والإنجليزي.
- جدول مبسّط للأنشطة الشائعة → `includedType` صحيح (نُنشئ map في `country-cities.ts`).

### الطبقة C — التوازي المكثّف (تسريع)
- **5 مدن متوازية** (Promise pool).
- داخل كل مدينة: **8–12 خلية متوازية** في وقت واحد (pool محلي).
- داخل كل خلية: 3 طلبات pagination تتابعية (إجباري لأن `nextPageToken` يتطلب التتابع + ~2s تأخير حسب توصية Google).
- **batch insert** لـ `scrape_results` كل 50–100 نتيجة بدلاً من إدراج فردي → تقليل round-trips.
- **upsert على `place_id`** (مع `onConflict: place_id, job_id`) → dedup تلقائي على مستوى DB.

### إدارة الحدود (Rate limits)
- Places API (New) حدّ افتراضي ~600 RPM (يمكن رفعه). 5 مدن × 10 خلايا × 3 صفحات = 150 طلب متوازي ذروة — ضمن الحد.
- إضافة retry exponential backoff على 429/5xx.

### تتبع التقدم لكل مدينة
- `progress` لكل مدينة = (خلايا منتهية / إجمالي خلايا) %.
- `current_step` نص قصير: "geocoding"، "scanning cell 7/16"، "enriching emails"، "done".
- update لـ `scrape_job_cities` بعد كل خلية.

## 6) أعمدة Excel
- اختصار إلى: **name, city, state, phone, whatsapp, website, email, maps_url** (8 أعمدة).

## 7) مكتبة + تصدير مجمّع
- زر "تصدير مجمّع" في `/library` → route جديد `/api/public/download-all` يجمع كل النتائج، dedup بـ `place_id` في الذاكرة، يصدّر Excel بنفس 8 أعمدة.
- إحصائية: "إجمالي السجلات الفريدة عبر كل العمليات: N" عبر server function جديدة.

## ملفات سيتم لمسها
- **migration**: إنشاء جدول `scrape_job_cities` + GRANTs + RLS.
- `src/components/city-picker.tsx` — جديد.
- `src/lib/country-cities.ts` — map للأنشطة → includedTypes.
- `src/lib/scraper.functions.ts` — schema يقبل `cities`، `getJobStatus` يُعيد per-city.
- `src/lib/scrape-engine.server.ts` — pool 5 مدن + grid tiling + adaptive subdivide + batch upsert + تحديث `scrape_job_cities`.
- `src/lib/places-grid.server.ts` — جديد: geocode + grid + adaptive subdivide.
- `src/routes/index.tsx` — تسمية + CityPicker + عرض per-city progress.
- `src/routes/api/public/download.$jobId.ts` — 8 أعمدة + تسمية ملف.
- `src/routes/api/public/download-all.ts` — جديد.
- `src/lib/library.functions.ts` — `getAggregateStats`.
- `src/routes/library.tsx`, `library.$jobId.tsx` — زر التصدير المجمّع + التسمية.

## النتيجة المتوقعة
- **التغطية**: من ~60 نتيجة/مدينة → مئات إلى آلاف (حسب حجم المدينة والنشاط).
- **السرعة**: 5 مدن متوازية × 10 خلايا متوازية × batch DB → تسريع ~10–20× مقارنة بالحلقة التتابعية الحالية، رغم زيادة عدد الطلبات.
- **الدقة**: dedup مزدوج (DB upsert + ذاكرة) → صفر مكرر.
- **التتبع**: شريط تقدم حقيقي لكل مدينة + خطوة حالية.

## ملاحظات تكلفة
Places API (New) `searchText`/`searchNearby` يُحاسَب لكل طلب. التقسيم الشبكي يضاعف عدد الطلبات (مدينة كبيرة قد تحتاج 30–60 طلب بدل 3). هذا ثمن "كل المتاجر". إن أردت، يمكن إضافة سقف "max cells per city" في الواجهة لاحقاً للتحكم بالتكلفة.
