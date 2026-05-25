## المشاكل الثلاث وحلولها الجذرية

### 1. مشكلة تنزيل Excel — تطلب تسجيل دخول

**السبب الحقيقي:** المسار `/api/download/$jobId` ليس تحت `/api/public/`، فعلى النطاق المنشور (`jameelmap.lovable.app`) تحجبه طبقة الحماية الافتراضية وتُحوّل المستخدم لصفحة دخول Lovable.

**الحل:**
- نقل الملف إلى `src/routes/api/public/download.$jobId.ts`
- تحديث الرابط في `src/routes/index.tsx` إلى `/api/public/download/${jobId}`

### 2. سقف ~750 نتيجة — توسعة المدن + استعلامات متعددة

**السبب الحقيقي:** Google Places ترجع **60 نتيجة كحد أقصى** لكل استعلام نصي. مع 30 مدينة فقط × استعلام واحد = ~750 بعد إزالة المكرر. لا يمكن تجاوز هذا إلا بتكثيف الاستعلامات.

**سياسة موحّدة تُطبَّق على كل بحث مستقبلي:**

استبدال قائمة USA الحالية بالقائمة الشاملة التي قدّمتها (**~140 مدينة** تغطي 50 ولاية + نقاط تجمّع المسلمين الرئيسية):

```
Northeast: NYC, Brooklyn, Queens, Bronx, Buffalo, Newark, Jersey City,
Paterson, Trenton, Philadelphia, Pittsburgh, Allentown, Boston, Worcester,
Springfield, Providence, Hartford, Bridgeport, Manchester NH, Portland ME, Burlington VT

Mid-Atlantic & DC: Washington DC, Baltimore, Silver Spring, Arlington,
Alexandria, Falls Church, Richmond, Wilmington

Southeast: Atlanta, Augusta, Columbus GA, Charlotte, Raleigh, Durham,
Greensboro, Columbia SC, Charleston, Jacksonville, Miami, Orlando, Tampa,
St. Petersburg, Fort Lauderdale, Boca Raton, Nashville, Memphis, Knoxville,
Louisville, Lexington, Birmingham AL, Montgomery, Jackson MS, Little Rock

Midwest: Chicago, Aurora IL, Rockford, Naperville, Detroit, Dearborn,
Grand Rapids, Warren, Sterling Heights, Columbus OH, Cleveland, Cincinnati,
Toledo, Akron, Indianapolis, Fort Wayne, Milwaukee, Madison, Minneapolis,
St. Paul, Kansas City MO, St. Louis, Omaha, Lincoln, Des Moines, Sioux Falls, Fargo

South & Texas: Houston, San Antonio, Dallas, Austin, Fort Worth, El Paso,
Plano, Irving, Garland, Frisco, Richardson, New Orleans, Baton Rouge,
Oklahoma City, Tulsa

Mountain West: Denver, Colorado Springs, Aurora CO, Phoenix, Tucson, Mesa,
Scottsdale, Tempe, Salt Lake City, Provo, Albuquerque, Santa Fe, Las Vegas,
Henderson, Reno, Boise, Billings, Cheyenne

Pacific West: LA, San Diego, San Jose, SF, Fresno, Sacramento, Long Beach,
Oakland, Anaheim, Riverside, Santa Ana, Irvine, Chino, Garden Grove, Pomona,
Seattle, Spokane, Tacoma, Portland OR, Eugene

HI/AK: Honolulu, Anchorage

Hotspots: Dearborn Heights, Hamtramck, Clifton NJ, Bridgeview IL, Fremont
```

**كلمات البحث الموحّدة للمساجد (11 صيغة):**
```
Mosque, Masjid, Islamic Center, Muslim Community Center, Jami Masjid,
Jamia Masjid, مسجد, Islamic Society, Islamic Association, Muslim Prayer, Musalla
```

**المنطق في `scrape-engine.server.ts`:**
- لكل مدينة × كل كلمة بحث ⇒ استعلام مستقل بصيغة `"{keyword} in {city}"`
- إزالة المكرر بالـ `place_id` (الواحد يظهر مرات كثيرة)
- النتائج المتوقعة لأمريكا/المساجد: **3000-4500** (يقترب من رقمك المرجعي)
- رفع السقف الأعلى لـ **10,000** نتيجة

**الوقت المتوقع:** ~140 مدينة × 11 كلمة × ~2ث = ~50 دقيقة (مع تأخير صفحات Google). نوازي 3 استعلامات بنفس الوقت ⇒ ~18 دقيقة فعلية.

**سياسة عامة لأي بحث مستقبلي:** أي نشاط جديد (مدارس، مكتبات، مستشفيات…) يطبّق نفس المبدأ — قائمة مدن شاملة + 5-10 صيغ بحث مختلفة بالعربي والإنجليزي + إزالة المكرر بالـ `place_id`. لن نكتفي أبداً بصيغة واحدة لمدن قليلة.

### 3. الحقول المطلوبة: إيميل + سوشيال — Google لا تعطيها

**السبب:** Places API ترجع فقط: الاسم، العنوان، الهاتف، الموقع، خرائط جوجل.

**الحل:** بعد جلب كل نتيجة فيها موقع إلكتروني، نزحف الموقع بـ **Firecrawl** (مربوط مسبقاً) لاستخراج:
- إيميل (regex على النص و `mailto:`)
- روابط Facebook / Instagram / Twitter/X / YouTube / TikTok / Snapchat / WhatsApp (regex على الـ links)

**التكلفة الواقعية:**
- كل مسجد فيه موقع = 1 رصيد Firecrawl. لأمريكا متوقع ~2000 موقع.
- المساجد بلا موقع = حقول السوشيال تبقى فارغة (لا مصدر بديل قانوني).
- موازاة 5 طلبات بنفس الوقت ⇒ زيادة ~15-20 دقيقة على وقت البحث.

### 4. توسعة جدول `scrape_results`

إضافة أعمدة:
- `email TEXT DEFAULT ''`
- `facebook TEXT DEFAULT ''`
- `instagram TEXT DEFAULT ''`
- `twitter TEXT DEFAULT ''`
- `youtube TEXT DEFAULT ''`
- `tiktok TEXT DEFAULT ''`
- `snapchat TEXT DEFAULT ''`

### 5. تحديث Excel بالترتيب المطلوب

الأعمدة النهائية: المدينة | اسم المسجد | العنوان | الجوال | الإيميل | الواتساب | الموقع الإلكتروني | فيسبوك | إنستقرام | تويتر | يوتيوب | تيك توك | سناب شات | خرائط جوجل

---

## خطوات التنفيذ بالترتيب

1. **migration**: إضافة الأعمدة الجديدة على `scrape_results`.
2. تحديث `src/lib/country-cities.ts`: استبدال USA بالقائمة الشاملة (~140 مدينة)، وتعريف مصفوفة `MOSQUE_KEYWORDS` بالـ 11 صيغة.
3. تعديل `scrape-engine.server.ts`:
   - حلقة مزدوجة (مدينة × كلمة بحث) بدل واحدة، مع كشف تلقائي إن كان النشاط مسجد/mosque لاستخدام قائمة الـ 11 كلمة، وإلا صيغة المستخدم فقط.
   - موازاة 3 استعلامات Google بنفس الوقت.
   - دالة `enrichWithFirecrawl(website)` بالموازاة (5 معاً) للنتائج ذات الموقع.
   - رفع السقف لـ 10,000.
4. نقل ملف التنزيل إلى `src/routes/api/public/download.$jobId.ts` + تحديث الرابط + الأعمدة الجديدة في Excel.
5. **الاختبار الفعلي قبل قول "تم":**
   - تشغيل USA/mosque عبر `invoke-server-function`.
   - متابعة `cities_done` و `results_count` للتأكد من التقدم.
   - `SELECT count(*), count(email) FILTER (WHERE email<>''), count(*) FILTER (WHERE website<>'') FROM scrape_results WHERE job_id=...`
   - تنزيل Excel من النطاق المنشور للتأكد من غياب redirect للوجن.
   - لن أقول "تم" إلا بعد رؤية الأرقام.

## ما لا أعدك به (صدق صريح)

- 10,000 مسجد في أمريكا = غير موجودين فعلياً على Google. الواقعي 3000-4500 بهذه القائمة.
- إيميل/سوشيال لكل مسجد = فقط للمساجد التي تذكرها في موقعها.
- تيك توك لا يُجمَع من اسم المسجد مباشرة — فقط إذا كان مرتبطاً من موقع المسجد.