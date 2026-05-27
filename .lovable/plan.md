## المشكلة
بعد إدخال البريد وكلمة المرور:
1. طلب `signInWithPassword` يرجع 200 ويُخزَّن الجلسة بنجاح.
2. `login.tsx` يستدعي `navigate({ to: "/" })` للانتقال إلى الرئيسية.
3. خلال انتقال TanStack Router (أثناء انتظار `beforeLoad` للـ`getUser`)، يطلق `supabase.auth.onAuthStateChange` حدث **SIGNED_IN** فوراً من داخل `AuthListener` في `src/routes/__root.tsx`، والذي يستدعي `router.invalidate()`.
4. `router.invalidate()` أثناء انتقال جارٍ يُلغي/يُعيد تقييم الانتقال فيرتد المستخدم إلى `/login` (الموقع الحالي قبل اكتمال الانتقال). هذه هي حلقة "فتح وإغلاق فوري".

تأكدت من الـ user_roles: المستخدم `ceo@salasah.sa` لديه دور `admin` (إذًا ليست المشكلة في حارس الأدوار).

## الحل

### 1) `src/routes/login.tsx` — انتقال صلب بعد الدخول
استبدال `navigate({ to: "/" })` بـ`window.location.assign("/")` ليكون تحميلاً كاملاً للصفحة، ما يضمن:
- تخزّن الجلسة في `localStorage` قبل تشغيل أي `beforeLoad`.
- لا يوجد انتقال TanStack نشط لكي يُلغى بواسطة `invalidate`.

نفس التعديل في `src/routes/bootstrap.tsx` (يستخدم نفس النمط بعد تهيئة المسؤول).

### 2) `src/routes/__root.tsx` — تحصين AuthListener
- تجاهل أول حدث (`INITIAL_SESSION`) لأنه يطلق مباشرة عند الاشتراك ولا يعكس تغييراً فعلياً.
- الاستجابة فقط لأحداث `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` / `USER_UPDATED`.
- إزالة `router.invalidate()` (يكفي `qc.invalidateQueries()` لإعادة جلب البيانات؛ إعادة تقييم المسار غير مطلوبة لأن الانتقال صار صلباً).

بهذا لا يحدث أي تدخل في انتقالات الراوتر بعد تسجيل الدخول.

### 3) ضمان عدم التكرار
- `login`/`bootstrap` يستخدمان `window.location.assign` دائماً (موثّق بتعليق قصير).
- `AuthListener` لا يُلغي مسارات الراوتر، فقط يبطل كاش الاستعلامات.

## الملفات المعدّلة
- `src/routes/login.tsx`
- `src/routes/bootstrap.tsx`
- `src/routes/__root.tsx`

لا تغييرات على قاعدة البيانات أو منطق Scrape.
