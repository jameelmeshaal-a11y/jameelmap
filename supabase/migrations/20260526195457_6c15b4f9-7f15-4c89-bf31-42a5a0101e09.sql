
-- ============= ENUMS =============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= scrape_jobs توسعة =============
ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS max_results integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_page_token text,
  ADD COLUMN IF NOT EXISTS processed_cities text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS from_cache boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_id ON public.scrape_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs(status);

-- ============= scrape_results توسعة + UNIQUE =============
ALTER TABLE public.scrape_results
  ADD COLUMN IF NOT EXISTS all_emails text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS country text DEFAULT '';

DO $$ BEGIN
  ALTER TABLE public.scrape_results
    ADD CONSTRAINT scrape_results_job_place_unique UNIQUE (job_id, place_id);
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_scrape_results_job_id ON public.scrape_results(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_place_id ON public.scrape_results(place_id);

-- ============= user_roles =============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- has any admin function (for bootstrap)
CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

DROP POLICY IF EXISTS "users read own role" ON public.user_roles;
CREATE POLICY "users read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= user_permissions =============
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_search boolean NOT NULL DEFAULT true,
  can_export boolean NOT NULL DEFAULT true,
  can_delete boolean NOT NULL DEFAULT false,
  can_view_library boolean NOT NULL DEFAULT true,
  max_searches_per_day integer NOT NULL DEFAULT 10,
  allowed_countries text[] NOT NULL DEFAULT ARRAY['US']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own perms" ON public.user_permissions;
CREATE POLICY "users read own perms" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage perms" ON public.user_permissions;
CREATE POLICY "admins manage perms" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= audit_log =============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text DEFAULT '',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);

DROP POLICY IF EXISTS "admins read audit" ON public.audit_log;
CREATE POLICY "admins read audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============= search_cache =============
CREATE TABLE IF NOT EXISTS public.search_cache (
  cache_key text PRIMARY KEY,
  data jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days')
);
GRANT SELECT ON public.search_cache TO authenticated;
GRANT ALL ON public.search_cache TO service_role;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON public.search_cache(expires_at);

DROP POLICY IF EXISTS "authenticated read cache" ON public.search_cache;
CREATE POLICY "authenticated read cache" ON public.search_cache
  FOR SELECT TO authenticated USING (true);

-- ============= استبدال RLS العامة على scrape_jobs / results / job_cities =============
-- scrape_jobs
DROP POLICY IF EXISTS "public read jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "public insert jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "public update jobs" ON public.scrape_jobs;

REVOKE ALL ON public.scrape_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrape_jobs TO authenticated;
GRANT ALL ON public.scrape_jobs TO service_role;

CREATE POLICY "users select own jobs" ON public.scrape_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own jobs" ON public.scrape_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own jobs" ON public.scrape_jobs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users delete own jobs" ON public.scrape_jobs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- scrape_results
DROP POLICY IF EXISTS "public read results" ON public.scrape_results;
DROP POLICY IF EXISTS "public insert results" ON public.scrape_results;

REVOKE ALL ON public.scrape_results FROM anon;
GRANT SELECT, DELETE ON public.scrape_results TO authenticated;
GRANT ALL ON public.scrape_results TO service_role;

CREATE POLICY "users read results of own jobs" ON public.scrape_results
  FOR SELECT TO authenticated
  USING (
    job_id IN (SELECT id FROM public.scrape_jobs WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "users delete results of own jobs" ON public.scrape_results
  FOR DELETE TO authenticated
  USING (
    job_id IN (SELECT id FROM public.scrape_jobs WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- scrape_job_cities
DROP POLICY IF EXISTS "public read job cities" ON public.scrape_job_cities;
DROP POLICY IF EXISTS "public insert job cities" ON public.scrape_job_cities;
DROP POLICY IF EXISTS "public update job cities" ON public.scrape_job_cities;
DROP POLICY IF EXISTS "public delete job cities" ON public.scrape_job_cities;

REVOKE ALL ON public.scrape_job_cities FROM anon;
GRANT SELECT, DELETE ON public.scrape_job_cities TO authenticated;
GRANT ALL ON public.scrape_job_cities TO service_role;

CREATE POLICY "users read cities of own jobs" ON public.scrape_job_cities
  FOR SELECT TO authenticated
  USING (
    job_id IN (SELECT id FROM public.scrape_jobs WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============= trigger updated_at =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
