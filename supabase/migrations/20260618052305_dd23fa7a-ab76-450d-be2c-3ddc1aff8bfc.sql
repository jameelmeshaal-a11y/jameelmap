
-- Plans
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_sar NUMERIC(10,2) NOT NULL DEFAULT 0,
  results_per_month INTEGER NOT NULL DEFAULT 0,
  jobs_per_month INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable to all" ON public.plans FOR SELECT USING (is_active = true);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  provider TEXT,
  provider_subscription_id TEXT,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Usage counters
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month TEXT NOT NULL,
  results_used INTEGER NOT NULL DEFAULT 0,
  jobs_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage" ON public.usage_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Seed plans
INSERT INTO public.plans (id, name, name_ar, price_sar, results_per_month, jobs_per_month, features, sort_order) VALUES
  ('free', 'Free', 'مجاني', 0, 500, 3,
   '["500 نتيجة شهرياً","3 وظائف بحث","تصدير Excel","استخراج بريد إلكتروني محدود"]'::jsonb, 1),
  ('pro', 'Professional', 'احترافي', 199, 10000, 50,
   '["10,000 نتيجة شهرياً","50 وظيفة بحث","تصدير Excel + CSV","استخراج بريد ووسائل تواصل","إشعارات البريد عند الاكتمال","دعم فني"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 'مؤسسي', 999, 999999, 999,
   '["نتائج غير محدودة","وظائف غير محدودة","أولوية في المعالجة","API خاص","مدير حساب مخصص"]'::jsonb, 3);

-- Triggers for updated_at
CREATE TRIGGER set_plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_usage_counters_updated BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_scrape_results_job_created ON public.scrape_results (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_results_phone ON public.scrape_results (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_created ON public.scrape_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_job_cities_job ON public.scrape_job_cities (job_id, status);
