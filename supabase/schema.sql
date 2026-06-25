-- supabase/schema.sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamp with time zone default now()
);

-- TRUSTED CONTACTS
create table public.trusted_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null,
  relation text,
  created_at timestamp with time zone default now()
);

-- EMERGENCY EVENTS
create table public.emergency_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  latitude double precision not null,
  longitude double precision not null,
  battery_percent int,
  speed_kmh double precision,
  selected_mode text check (selected_mode in ('DETERRENT_MODE','STEALTH_MODE')),
  ai_reasoning text,
  status text default 'ACTIVE',
  created_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);

-- ROUTE CHECKS
create table public.route_checks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_text text not null,
  destination_text text not null,
  source_lat double precision,
  source_lng double precision,
  dest_lat double precision,
  dest_lng double precision,
  safety_score int,
  risk_level text,
  ai_summary text,
  created_at timestamp with time zone default now()
);

-- COMMUNITY REPORTS
create table public.community_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  latitude double precision not null,
  longitude double precision not null,
  tag text check (tag in ('POORLY_LIT','ISOLATED','SAFE')) not null,
  note text,
  created_at timestamp with time zone default now()
);

-- RLS POLICIES
alter table public.profiles enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.emergency_events enable row level security;
alter table public.route_checks enable row level security;
alter table public.community_reports enable row level security;

-- Profiles: users can only read/write their own
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Trusted Contacts: own rows only
create policy "Users can read own contacts" on public.trusted_contacts for select using (auth.uid() = user_id);
create policy "Users can insert own contacts" on public.trusted_contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts" on public.trusted_contacts for update using (auth.uid() = user_id);
create policy "Users can delete own contacts" on public.trusted_contacts for delete using (auth.uid() = user_id);

-- Emergency Events: own rows only
create policy "Users can read own events" on public.emergency_events for select using (auth.uid() = user_id);
create policy "Users can insert own events" on public.emergency_events for insert with check (auth.uid() = user_id);
create policy "Users can update own events" on public.emergency_events for update using (auth.uid() = user_id);

-- Route Checks: own rows only
create policy "Users can read own routes" on public.route_checks for select using (auth.uid() = user_id);
create policy "Users can insert own routes" on public.route_checks for insert with check (auth.uid() = user_id);

-- Community Reports: public read, authenticated insert
create policy "Anyone can read reports" on public.community_reports for select using (true);
create policy "Users can insert reports" on public.community_reports for insert with check (auth.uid() = user_id);
create policy "Users can update own reports" on public.community_reports for update using (auth.uid() = user_id);
create policy "Users can delete own reports" on public.community_reports for delete using (auth.uid() = user_id);
