
# تنفيذ أمر العمل WO-JM-2026-001 — جميل ماب

## المرحلة 1 — الإصلاحات العاجلة (الأسبوع 1)

### 1.1 إصلاح صفحة عرض النتائج `/library/$jobId` (حرجة)
- التحقق من المكوّن الحالي وقراءة `params.jobId` بشكل صحيح ودمج عرض كامل للنتائج:
  - جدول بيانات مع pagination خادمية (50 سجل/صفحة)، بحث نصي على الاسم/المدينة/الهاتف، فلترة حسب وجود (هاتف/بريد/موقع/سوشيال)، فرز.
  - أعمدة: الاسم، التصنيف، المدينة، الهاتف، البريد، الموقع، Maps، السوشيال (placeholder للمرحلة 3).
  - أزرار: تصدير Excel لهذه الوظيفة، جلب الإيميلات، حذف.
- إضافة `errorComponent` و`notFoundComponent` للمسار.

### 1.2 إظهار/إخفاء كلمة المرور (عالية)
- مكوّن مشترك `<PasswordInput>` يدير `useState` ويبدّل `type` بين `password`/`text` مع أيقونة Eye/EyeOff (lucide-react).
- استبداله في: `/login`، نموذج إنشاء المستخدم في `/admin`، نموذج تغيير كلمة المرور (لاحقاً).

### 1.3 تعطيل التعبئة التلقائية في إنشاء المستخدم (متوسطة)
- إضافة `autoComplete="new-password"` لحقل كلمة المرور و`autoComplete="off"` لحقل البريد في فورم admin.
- تفريغ الحقول صراحة عند تبديل التبويب لـ "إنشاء".

### 1.4 رابط "نسيت كلمة المرور؟" (منخفضة)
- صفحة عامة `/forgot-password`: تستدعي `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`.
- صفحة عامة `/reset-password`: تتحقق من `type=recovery` في الـ hash وتستدعي `supabase.auth.updateUser({ password })`.
- إضافة الرابط في `/login`.

### 1.5 معالجة فشل المدن الصامت (متوسطة)
- في `scrape-engine.server.ts`: حفظ سبب فشل المدينة في `scrape_job_cities.error_message` + علم `retried` (boolean).
- إعادة محاولة تلقائية واحدة للمدن الفاشلة قبل اعتبارها فاشلة نهائياً.
- في صفحة تفاصيل الوظيفة: لوحة "المدن الفاشلة" تعرض الأسماء والأسباب وزر "إعادة محاولة" يدوي.

---

## المرحلة 2 — نظام الاشتراكات والدفع (الأسبوع 2-3)

> **ملاحظة بوابة الدفع:** المستند يقترح Moyasar، لكن Lovable يدعم Stripe Payments ودمج جاهز (يعمل في السعودية ويدعم Mada عبر Stripe). سأستخدم **Stripe Payments المدمج** ما لم يصرّ المستخدم على Moyasar (يتطلب تكامل يدوي بمفتاح خاص).

### 2.1 جداول قاعدة البيانات (migration)
- `plans`: `id, name, price_sar, results_per_month, jobs_per_month, features[], is_active`.
- `subscriptions`: `id, user_id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id, cancel_at`.
- `usage_counters`: `user_id, month (YYYY-MM), results_used, jobs_used` + Unique على `(user_id, month)`.
- RLS + GRANT لكل جدول حسب السياسات المعروفة.

### 2.2 صفحة `/pricing` عامة
- 3 باقات: مجاني (500 نتيجة، 3 وظائف)، احترافي (10K نتيجة، 50 وظيفة)، مؤسسي (غير محدود).
- زر "اشترك" يستدعي server fn لإنشاء جلسة دفع.

### 2.3 تكامل Stripe Payments
- استدعاء `payments--recommend_payment_provider` ثم `enable_stripe_payments`.
- إنشاء المنتجات بـ `batch_create_product` بعد التفعيل.
- webhook `/api/public/webhooks/stripe` بتحقق توقيع لتحديث `subscriptions`.

### 2.4 تقييد الاستخدام بالخطة
- middleware في `startScrape`: قراءة الخطة الحالية + `usage_counters` للشهر، رفض الطلب إذا تجاوز الحد مع رسالة "ارتقِ بالباقة".
- تحديث `usage_counters` ذرياً بعد كل وظيفة ناجحة.
- شريط استخدام في `/library` يعرض النسبة المستهلكة.

---

## المرحلة 3 — وسائل التواصل والإشعارات (الأسبوع 4-5)

### 3.1 استخراج وسائل التواصل
- توسيع `email-scraper.server.ts` ليلتقط روابط Instagram/Twitter/Snapchat/TikTok/Facebook من HTML الموقع (regex على `instagram.com/`, `twitter.com/`, `x.com/`, `snapchat.com/add/`, `tiktok.com/@`, `facebook.com/`).
- حفظها في أعمدة موجودة بـ `scrape_results` (instagram, twitter, snapchat, tiktok, facebook) — موجودة فعلاً حسب schema.
- إضافة أعمدتها لتصدير Excel والصفحة التفصيلية.

### 3.2 إشعارات البريد عند الاكتمال
- ربط connector Resend.
- server fn `notifyJobComplete` يُستدعى في نهاية `scrape-engine` عند `completed`.
- قالب عربي يحوي: اسم النشاط، الدولة، عدد النتائج، رابط مباشر `/library/$jobId`.
- تفضيل المستخدم في `user_permissions` (عمود `notify_on_complete boolean default true`).

### 3.3 تحسين الأداء
- Index على `scrape_results(job_id, created_at desc)` و`(phone, maps_url)` للـ dedup.
- تفعيل `prefetch` لمسارات `/library` و`/library/$jobId`.

---

## المرحلة 4 — الإطلاق والمراقبة (الأسبوع 6)

### 4.1 اختبار شامل عبر Playwright
سيناريوهات: تسجيل دخول، نسيان كلمة مرور، إنشاء وظيفة، عرض النتائج، تصدير، اشتراك، تجاوز الحد.

### 4.2 مراجعة الأمان
- تشغيل `security--run_security_scan` ومعالجة كل النتائج.
- تأكيد RLS على كل الجداول الجديدة.
- تفعيل HIBP في `configure_auth`.

### 4.3 Google Analytics
- إضافة GA4 عبر `<script>` في `__root.tsx` head، خلف موافقة المستخدم (banner مبسط).

### 4.4 صفحات التسويق
- تحديث `/` بـ hero + features + CTA → `/pricing`.
- صفحة `/contact` للدعم.
- meta tags ديناميكية لكل صفحة (title/description/og:image).

---

## تفاصيل تقنية

- **هيكلة الملفات الجديدة:**
  - `src/components/password-input.tsx`
  - `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`
  - `src/routes/pricing.tsx`
  - `src/routes/api/public/webhooks/stripe.ts`
  - `src/lib/billing.functions.ts`, `src/lib/billing.server.ts`
  - `src/lib/notifications.functions.ts`
  - `supabase/migrations/*_plans_subscriptions_usage.sql`
- **عدم تعديل:** `src/integrations/supabase/*` (auto-gen)، نواة scrape-engine منطقياً (فقط إضافة hook إشعار + retry).
- **رفع المخاطر:** Stripe في السعودية يدعم البطاقات الدولية ومدى عبر Stripe Connect؛ لو احتاج العميل STC Pay فعلياً نضيف Moyasar لاحقاً كبوابة ثانية.

---

## ترتيب التنفيذ المُقترح
ابدأ بالمرحلة 1 كاملة (يمكن تنفيذها في turn واحد)، ثم انتظر مراجعة المستخدم قبل الانتقال لكل مرحلة لاحقة، لأن مراحل 2-4 تتطلب قرارات (موافقة Stripe، أسعار الباقات، مفاتيح Resend، إلخ).
