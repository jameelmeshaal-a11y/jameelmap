## السبب الجذري

اختبرت نداء `geocode` مباشرة عبر البوابة:

```
GET /google_maps/maps/api/geocode/json?address=Tabuk,+Saudi+Arabia
→ HTTP 429
{"type":"rate_limited","message":"Rate limit exceeded. Please try again in 86400 seconds."}
```

أي أن واجهة **Geocoding API القديمة** على موصل Google Maps محظورة لمدة 24 ساعة. كل المدن فشلت لأن `geocodeCity()` في `src/lib/places-grid.server.ts` ترجع `null` فيُسجَّل "geocode failed" لكل مدينة. هذا ليس خطأ في كود المدن — هو خطأ في نقطة النهاية المستخدمة.

## الحل المباشر (سيُنفَّذ عند الموافقة)

استبدال نداء `geocodeCity` لاستخدام **Places API (New) `places:searchText`** بدل `Geocoding API` القديم. هذه نفس الواجهة التي نستخدمها بنجاح في `cities-fetch.functions.ts` (بركة حصص مستقلة وغير محظورة)، وترجع `location` و `viewport` مباشرةً.

### تعديل واحد في `src/lib/places-grid.server.ts › geocodeCity()`

- POST إلى `${GATEWAY}/places/v1/places:searchText`
- الرؤوس: `Authorization`, `X-Connection-Api-Key`, `Content-Type`, و
  `X-Goog-FieldMask: places.location,places.viewport`
- البودي:
  ```json
  { "textQuery": "<city>, <country>", "languageCode": "en", "pageSize": 1 }
  ```
- قراءة:
  - `places[0].location` → `{latitude, longitude}` كمركز
  - `places[0].viewport` → `{ low, high }` مباشرةً (بنفس الشكل الذي يستهلكه `tileViewport`)
- في حال عدم وجود `viewport`، نُبقي fallback الحالي (مربع ~10كم حول المركز).

### آلية أمان إضافية

- إذا عاد 429، يُعاد المحاولة مرة واحدة بعد 500ms ثم يُعاد رفع الخطأ كرسالة عربية واضحة "تعذّر تحديد الإحداثيات (حد المعدّل)" بدل "تعذّر تحديد الإحداثيات" المبهم.

### بعد التعديل

- يمكنك الضغط على زر **استئناف** في نفس المهمة → تعيد تشغيل المدن الفاشلة دون بدء عملية جديدة، ويجب أن تنجح فوراً.

## ما لن يتغير

- منطق البحث الشبكي، التخزين المؤقت، إزالة المكرر، الإثراء — كلها كما هي.
- لا تعديلات على الواجهة أو قاعدة البيانات أو الاتصالات.
