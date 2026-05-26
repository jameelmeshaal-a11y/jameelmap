
CREATE TABLE public.scrape_job_cities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  city text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  results_count integer NOT NULL DEFAULT 0,
  current_step text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX scrape_job_cities_job_city_idx ON public.scrape_job_cities (job_id, city);
CREATE INDEX scrape_job_cities_job_idx ON public.scrape_job_cities (job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrape_job_cities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrape_job_cities TO authenticated;
GRANT ALL ON public.scrape_job_cities TO service_role;

ALTER TABLE public.scrape_job_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read job cities" ON public.scrape_job_cities FOR SELECT USING (true);
CREATE POLICY "public insert job cities" ON public.scrape_job_cities FOR INSERT WITH CHECK (true);
CREATE POLICY "public update job cities" ON public.scrape_job_cities FOR UPDATE USING (true);
CREATE POLICY "public delete job cities" ON public.scrape_job_cities FOR DELETE USING (true);
