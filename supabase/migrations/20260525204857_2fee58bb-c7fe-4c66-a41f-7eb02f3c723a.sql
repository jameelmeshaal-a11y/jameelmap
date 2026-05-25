
create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  activity text not null,
  status text not null default 'pending',
  current_city text default '',
  cities_done int not null default 0,
  cities_total int not null default 0,
  results_count int not null default 0,
  error_message text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scrape_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  place_id text not null,
  name text default '',
  address text default '',
  city text default '',
  state text default '',
  phone text default '',
  whatsapp text default '',
  website text default '',
  category text default '',
  maps_url text default '',
  created_at timestamptz not null default now(),
  unique (job_id, place_id)
);

create index idx_scrape_results_job on public.scrape_results(job_id);
create index idx_scrape_jobs_created on public.scrape_jobs(created_at desc);

alter table public.scrape_jobs enable row level security;
alter table public.scrape_results enable row level security;

create policy "public read jobs" on public.scrape_jobs for select using (true);
create policy "public insert jobs" on public.scrape_jobs for insert with check (true);
create policy "public update jobs" on public.scrape_jobs for update using (true);

create policy "public read results" on public.scrape_results for select using (true);
create policy "public insert results" on public.scrape_results for insert with check (true);
