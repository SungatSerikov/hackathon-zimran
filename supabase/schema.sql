-- Run once in the SQL editor of a new Supabase project.
-- This anonymous demo validates shape/ranges, not player honesty or request rate.
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  case_id text not null check (case_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  nickname text not null check (
    char_length(nickname) between 2 and 20
    and nickname = btrim(nickname)
    and nickname !~ '[[:cntrl:]]'
  ),
  score integer not null check (score between 0 and 1000),
  time_ms integer not null check (time_ms between 0 and 2147483647),
  wrong integer not null check (wrong between 0 and 3),
  searches integer not null check (searches between 0 and 10000),
  created_at timestamptz not null default now()
);

create index scores_case_ranking on public.scores (case_id, score desc, time_ms, created_at);

-- One browser-generated UUID is reused for retry-safe interest registration.
-- No email or notification permission is collected.
create table public.waitlist_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;
alter table public.waitlist_clicks enable row level security;

revoke all on public.scores, public.waitlist_clicks from anon, authenticated;
grant select, insert on public.scores, public.waitlist_clicks to anon;

create policy "Anonymous score reads" on public.scores
  for select to anon using (true);
create policy "Anonymous score inserts" on public.scores
  for insert to anon with check (created_at <= now() + interval '5 minutes');
create policy "Anonymous interest count" on public.waitlist_clicks
  for select to anon using (true);
create policy "Anonymous interest inserts" on public.waitlist_clicks
  for insert to anon with check (created_at <= now() + interval '5 minutes');

-- UPDATE and DELETE have neither grants nor policies.
-- For a public production competition, use server-verified scores and rate limits.
