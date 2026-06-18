import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — جميل ماب" },
      { name: "description", content: "كيف نجمع ونستخدم ونحمي بياناتك في منصة جميل ماب." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-primary hover:underline">← الرئيسية</Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">سياسة الخصوصية والاستخدام</h1>
        <p className="mt-2 text-sm text-muted-foreground">آخر تحديث: يونيو 2026</p>

        <section className="prose prose-sm mt-8 max-w-none text-foreground" dir="rtl">
          <h2 className="mt-6 text-xl font-semibold">1. البيانات التي نجمعها</h2>
          <p className="mt-2 text-sm leading-relaxed">
            نجمع البريد الإلكتروني وكلمة المرور المُشفّرة لإنشاء الحساب، إضافةً إلى سجل وظائف الاستخراج التي تنفّذها داخل المنصة (التصنيف، الدول، النتائج، الإحصائيات).
          </p>

          <h2 className="mt-6 text-xl font-semibold">2. كيف نستخدم البيانات</h2>
          <ul className="mt-2 list-disc space-y-1 pr-6 text-sm">
            <li>تشغيل خدمة الاستخراج وعرض النتائج لك حصراً.</li>
            <li>إدارة حدود الاستخدام بحسب باقتك.</li>
            <li>إرسال إشعارات تشغيلية (اكتمال وظيفة، تنبيهات الحساب).</li>
            <li>تحسين الأداء وتشخيص الأخطاء.</li>
          </ul>

          <h2 className="mt-6 text-xl font-semibold">3. مشاركة البيانات</h2>
          <p className="mt-2 text-sm leading-relaxed">
            لا نبيع بياناتك ولا نشاركها مع أطراف ثالثة لأغراض تسويقية. نستخدم خدمات تشغيلية موثوقة (Google Maps Platform لجلب بيانات الأماكن العامة، Lovable Cloud لقاعدة البيانات والمصادقة) محكومة بسياسات خصوصيتها الرسمية.
          </p>

          <h2 className="mt-6 text-xl font-semibold">4. البيانات المُستخرجة</h2>
          <p className="mt-2 text-sm leading-relaxed">
            البيانات التي تستخرجها (أسماء أنشطة، أرقام، روابط) هي معلومات عامة منشورة على خرائط Google ومواقع الأنشطة. أنت مسؤول عن استخدامها وفق أنظمة حماية البيانات المعمول بها في بلدك (PDPL في السعودية، GDPR في أوروبا، إلخ) والامتناع عن أي تواصل تسويقي غير مرغوب.
          </p>

          <h2 className="mt-6 text-xl font-semibold">5. الأمان</h2>
          <p className="mt-2 text-sm leading-relaxed">
            نستخدم تشفير TLS لجميع الاتصالات، وسياسات Row-Level Security لعزل بيانات كل مستخدم، وكلمات مرور مُجزَّأة (hashed) مع فحص ضد قواعد كلمات المرور المسرّبة (HIBP).
          </p>

          <h2 className="mt-6 text-xl font-semibold">6. حقوقك</h2>
          <p className="mt-2 text-sm leading-relaxed">
            يحق لك طلب نسخة من بياناتك أو حذف حسابك بالكامل في أي وقت بالتواصل مع فريق الدعم.
          </p>

          <h2 className="mt-6 text-xl font-semibold">7. التواصل</h2>
          <p className="mt-2 text-sm leading-relaxed">
            لأي استفسار يخص الخصوصية: <a href="mailto:support@jameelmap.com" className="text-primary hover:underline">support@jameelmap.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
