
# عالم جميل — مستخرج بيانات الأماكن

تطبيق ويب بسيط بمدخلين فقط (الدولة + النشاط) يجمع بيانات الأماكن من Google Places API (New) عبر موصل Google Maps Platform الجاهز في Lovable، ثم يصدّر ملف Excel `.xlsx` منسّق احترافياً جاهز للتحميل فوراً.

## الواجهة (صفحة واحدة)

نموذج بسيط بلونين رئيسيين (أخضر إسلامي + أبيض):
- حقل **الدولة** (مثال: USA، السعودية، مصر)
- حقل **النشاط** (مثال: Mosque، مطعم، صيدلية)
- زر **"ابدأ الجمع"** + شريط تقدّم حيّ يعرض المدينة الحالية وعدد النتائج
- جدول معاينة للنتائج أثناء الجمع
- زر **"تحميل Excel"** يظهر عند الانتهاء

## آلية العمل (خلف الكواليس)

1. **توسعة الدولة إلى مدن**: قائمة جاهزة في الكود لأكبر 20–40 مدينة لكل دولة شائعة (USA, KSA, Egypt, UAE, UK, Canada, France, Germany, Turkey...). إذا الدولة غير معروفة → بحث واحد بصيغة `<نشاط> in <دولة>`.
2. **لكل (مدينة × نشاط)** → نداء `places:searchText` على Places API (New) عبر بوابة موصل Google Maps، نسحب 60 نتيجة كحدّ أقصى (3 صفحات × 20).
3. لكل مكان نأخذ مباشرة من نفس الاستجابة (FieldMask واحد، بدون نداءات إضافية): `displayName, formattedAddress, internationalPhoneNumber, websiteUri, primaryTypeDisplayName, googleMapsUri, location`.
4. **إزالة التكرار** بمفتاح `place.id` + تطبيع رقم الهاتف لصيغة E.164.
5. **WhatsApp**: إذا الهاتف موبايل صالح → نُعبّئ نفس الرقم.
6. **State/Region**: يُستخرج من `formattedAddress` (آخر مقطع قبل الدولة).
7. **بثّ التقدّم**: serverFn يُرجع `{ city, done, total, batch }` بشكل متكرر، والواجهة تتابع عبر polling لتحديث الشريط.

## مخرج Excel

ملف `.xlsx` يُولَّد على السيرفر بـ `exceljs` (يعمل في Cloudflare Workers بدون مشاكل) ويُرسل كـ download:
- اسم الورقة: `عالم جميل - <النشاط>`
- أعمدة عربية مع رأس أخضر (#1B6B3A) أبيض غامق، صفوف مخططة (zebra)
- الأعمدة: الاسم • العنوان • المدينة • الولاية/المنطقة • الهاتف • واتساب • الموقع الإلكتروني • التصنيف • رابط خرائط جوجل
- محاذاة يمين للنص العربي، يسار للروابط، وسط للأرقام
- عرض أعمدة تلقائي، تجميد الصف الأول، فلاتر مفعّلة

## البنية التقنية

- **Frontend** (`src/routes/index.tsx`): نموذج + شريط تقدم + جدول معاينة (TanStack Query + shadcn)
- **Server Functions** (`src/lib/scraper.functions.ts`):
  - `startScrape({ country, activity })` → يرجع `jobId`
  - `getJobStatus({ jobId })` → يرجع التقدّم والنتائج الجزئية
  - `downloadExcel({ jobId })` → يولّد ويرجع ملف xlsx (base64) أو يحوّل لخدمة route تنزيل
- **Server Route** (`src/routes/api/download.$jobId.ts`): يرجع `Response` مع `Content-Type: application/vnd.openxmlformats...` و`Content-Disposition: attachment`
- **حالة المهام**: تُحفظ في Lovable Cloud (جدول `scrape_jobs` + `scrape_results`) لأن worker stateless — هذا يضمن "قاعدة بيانات صحيحة 100٪" ويسمح باستئناف/تنزيل لاحقاً
- **قائمة المدن**: في `src/lib/country-cities.ts` (ثابتة، يمكن توسعتها بسهولة)

## التبعيات

- `exceljs` لتوليد Excel
- موصل **Google Maps Platform** (مُدار من Lovable، بدون مفتاح من المستخدم)
- **Lovable Cloud** لحفظ المهام والنتائج

## ملاحظة مهمة عن "GitHub" و"أي متصفح"

- الواجهة HTML/JS عادي → يفتح على أي متصفح (Chrome/Edge/Safari/Firefox) بدون أي إعدادات
- المشروع كله مُستضاف على Lovable ويُمكن وصله بـ GitHub من زر **GitHub → Connect** أعلى المحرر، فيصبح كل تغيير ينعكس تلقائياً على ريبو
- لا حاجة لتثبيت Python أو Chrome أو drivers — لأن الجمع يتم سيرفر-سايد عبر API رسمي

## نقاط لاحقة (خارج هذا التسليم)

- استخراج البريد الإلكتروني من المواقع → يحتاج موصل Firecrawl، يمكن إضافته كخطوة ثانية
- جدولة دورية / تصدير CSV / رفع لـ Google Sheets

عند الموافقة على الخطة سأبدأ بـ: تفعيل Lovable Cloud → إنشاء جدول المهام → ربط موصل Google Maps → بناء serverFn → بناء الواجهة → اختبار ببحث "Mosque in USA".
