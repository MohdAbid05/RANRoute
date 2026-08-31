-- ── RouteOne Database Schema ────────────────────────────────────────────────
-- Run this once in the Supabase SQL editor.

-- ── customers ────────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  contact     text,
  phone       text,
  email       text,
  address     text not null,
  lat         double precision,
  lon         double precision,
  verified    boolean not null default false,
  source      text not null default 'manual' check (source in ('manual','excel','ai')),
  created_at  timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy if not exists "users manage own customers"
  on public.customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── set_routes ───────────────────────────────────────────────────────────────

create table if not exists public.set_routes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  customer_ids     uuid[] not null default '{}',
  last_constraints jsonb,
  recurrence       text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.set_routes enable row level security;

create policy if not exists "users manage own set_routes"
  on public.set_routes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── route_runs ───────────────────────────────────────────────────────────────

create table if not exists public.route_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  depot_address     text not null,
  customer_ids      uuid[] not null default '{}',
  optimized_order   uuid[] not null default '{}',
  constraints       jsonb,
  total_distance_m  double precision,
  total_duration_s  double precision,
  naive_distance_m  double precision,
  naive_duration_s  double precision,
  status            text not null default 'draft' check (status in ('draft','saved','started','completed')),
  created_at        timestamptz not null default now()
);

alter table public.route_runs enable row level security;

create policy if not exists "users manage own route_runs"
  on public.route_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
