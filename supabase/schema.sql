-- Run this once in Supabase Dashboard → SQL Editor.
create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  mode text not null check (mode in ('standard', 'agentic')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  checks integer not null default 0,
  public_findings integer not null default 0,
  results jsonb not null default '[]'::jsonb
);
alter table public.scan_history enable row level security;
create policy "Users read their own scans" on public.scan_history for select using (auth.uid() = user_id);
create policy "Users insert their own scans" on public.scan_history for insert with check (auth.uid() = user_id);
create policy "Users update their own scans" on public.scan_history for update using (auth.uid() = user_id);
