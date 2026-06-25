-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
--
-- Creates the table for email-verified PIN change requests

create table if not exists public.pin_change_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       varchar(128) not null unique,
  new_pin_hash varchar(255) not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '15 minutes'),
  used        boolean not null default false,
  ip_address  varchar(45)
);

-- Index for fast token lookup
create index if not exists idx_pin_change_token on public.pin_change_requests(token);
create index if not exists idx_pin_change_user  on public.pin_change_requests(user_id);

-- Audit log table (no PINs stored, ever)
create table if not exists public.pin_change_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  outcome    varchar(20) not null, -- 'requested' | 'success' | 'expired' | 'already_used' | 'rate_limited'
  ip_address varchar(45),
  created_at timestamptz not null default now()
);

-- Rate-limiting helper: count recent requests per user
create or replace function public.pin_change_request_count(p_user_id uuid, p_window interval)
returns bigint
language sql stable
as $$
  select count(*) from public.pin_change_requests
  where user_id = p_user_id
    and created_at > now() - p_window;
$$;

-- Enable Row Level Security — service-role key bypasses these (API routes)
alter table public.pin_change_requests enable row level security;
alter table public.pin_change_audit     enable row level security;

-- Only authenticated owner can read their own rows (optional; API routes use service key)
create policy "Owner read" on public.pin_change_requests
  for select using (auth.uid() = user_id);
