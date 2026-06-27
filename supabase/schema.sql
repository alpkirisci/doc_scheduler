-- ===========================================================================
-- doc_scheduler — Supabase schema + Row-Level Security
--
-- Paste this whole file into the Supabase dashboard: SQL Editor -> New query
-- -> Run. It is idempotent-ish for a fresh project. All data is PRIVATE per
-- user (keyed on auth.uid()); the app is NOT collaborative.
-- ===========================================================================

-- gen_random_uuid() ships with Supabase (pgcrypto). Safe to ensure:
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helper: force owner_id = the logged-in user on every write
-- ---------------------------------------------------------------------------
create or replace function public.set_owner_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := auth.uid();
  if new.owner_id is null then
    raise exception 'not authenticated';
  end if;
  return new;
end $$;

-- helper: assert a referenced project belongs to the current user
create or replace function public.assert_owns_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.owner_id = auth.uid()
  ) then
    raise exception 'project does not belong to current user';
  end if;
  return new;
end $$;

-- ============================ PROJECTS =====================================
create table if not exists public.projects (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                     text not null,
  description              text,
  start_date               date not null,
  end_date                 date not null,
  timezone                 text not null default 'Europe/Istanbul',
  locale                   text not null default 'tr' check (locale in ('tr','en')),
  -- SINGLE SOURCE OF TRUTH for rest: minimum hours between a person's shifts.
  rest_hours_min           int  not null default 24,
  max_duties_per_day       int  not null default 1,
  target_duties_per_person int,
  -- tunable scheduler weights + any extra settings live here
  settings                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ============================ PEOPLE =======================================
create table if not exists public.people (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name           text not null,
  short_label         text,
  color               text,
  is_difficult        boolean not null default false,
  is_active           boolean not null default true,
  target_total_duties int,
  notes               text,
  created_at          timestamptz not null default now()
);

-- ============================ ROOMS ========================================
create table if not exists public.rooms (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  owner_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                      text not null,
  capacity                  int  not null check (capacity > 0),
  color                     text,
  is_two_person_undesirable boolean not null default false,
  sort_order                int  not null default 0,
  created_at                timestamptz not null default now(),
  unique (project_id, name)
);

-- ========================== SHIFT_DEFS =====================================
-- Time blocks that tile a day so 24h coverage is met without anyone working
-- 24h straight (e.g. one 24h on-call, or Day 08-20 / Night 20-08).
create table if not exists public.shift_defs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  start_time       time not null,
  duration_minutes int  not null check (duration_minutes > 0 and duration_minutes <= 1440),
  is_night         boolean not null default false,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  unique (project_id, name)
);

-- ========================= AVAILABILITY ====================================
create table if not exists public.availability (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  the_date     date not null,
  shift_def_id uuid references public.shift_defs(id) on delete cascade,  -- null = whole day
  kind         text not null default 'unavailable'
                 check (kind in ('unavailable','prefer_off','must_work')),
  reason       text,
  created_at   timestamptz not null default now(),
  unique (person_id, the_date, shift_def_id)
);

-- ========================= PAIRING_RULES ===================================
create table if not exists public.pairing_rules (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_a   uuid not null references public.people(id) on delete cascade,
  person_b   uuid not null references public.people(id) on delete cascade,
  kind       text not null check (kind in ('want_together','avoid_together','never_alone')),
  weight     int  not null default 1,
  is_hard    boolean not null default false,
  created_at timestamptz not null default now(),
  check (person_a <> person_b),
  unique (project_id, person_a, person_b, kind)
);

-- =========================== SCHEDULES =====================================
create table if not exists public.schedules (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label           text,
  status          text not null default 'draft' check (status in ('draft','active','archived')),
  engine_version  text,
  seed            bigint,
  params_snapshot jsonb not null default '{}'::jsonb,
  fairness_score  numeric(6,2),
  generated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ========================== ASSIGNMENTS ====================================
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  the_date     date not null,
  shift_def_id uuid not null references public.shift_defs(id) on delete cascade,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  slot_index   int  not null default 0,
  is_locked    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (schedule_id, the_date, shift_def_id, room_id, slot_index)
);
create index if not exists assignments_sched_date_idx on public.assignments (schedule_id, the_date);
create index if not exists assignments_sched_person_idx on public.assignments (schedule_id, person_id);

-- assignment cross-FK integrity: all parents must share the assignment's project
create or replace function public.assert_assignment_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.schedules s where s.id = new.schedule_id and s.project_id = new.project_id)
     or not exists (select 1 from public.people p where p.id = new.person_id and p.project_id = new.project_id)
     or not exists (select 1 from public.rooms r where r.id = new.room_id and r.project_id = new.project_id)
     or not exists (select 1 from public.shift_defs d where d.id = new.shift_def_id and d.project_id = new.project_id)
  then
    raise exception 'assignment references rows from a different project';
  end if;
  return new;
end $$;

-- ================== owner + integrity triggers (all tables) =================
do $$
declare t text;
begin
  foreach t in array array[
    'projects','people','rooms','shift_defs','availability',
    'pairing_rules','schedules','assignments'
  ] loop
    execute format('drop trigger if exists trg_set_owner_%1$s on public.%1$s;', t);
    execute format(
      'create trigger trg_set_owner_%1$s before insert or update on public.%1$s
         for each row execute function public.set_owner_id();', t);
  end loop;

  -- same-owner project check on every child of projects
  foreach t in array array[
    'people','rooms','shift_defs','availability','pairing_rules','schedules','assignments'
  ] loop
    execute format('drop trigger if exists trg_owns_project_%1$s on public.%1$s;', t);
    execute format(
      'create trigger trg_owns_project_%1$s before insert or update on public.%1$s
         for each row execute function public.assert_owns_project();', t);
  end loop;
end $$;

drop trigger if exists trg_assignment_integrity on public.assignments;
create trigger trg_assignment_integrity before insert or update on public.assignments
  for each row execute function public.assert_assignment_integrity();

-- ============================= RLS =========================================
-- Enable + force RLS, then 4 explicit policies per table, all keyed on owner.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','people','rooms','shift_defs','availability',
    'pairing_rules','schedules','assignments'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force  row level security;', t);

    execute format('drop policy if exists %1$s_sel on public.%1$s;', t);
    execute format('drop policy if exists %1$s_ins on public.%1$s;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$s;', t);
    execute format('drop policy if exists %1$s_del on public.%1$s;', t);

    execute format('create policy %1$s_sel on public.%1$s for select to authenticated
        using (owner_id = (select auth.uid()));', t);
    execute format('create policy %1$s_ins on public.%1$s for insert to authenticated
        with check (owner_id = (select auth.uid()));', t);
    execute format('create policy %1$s_upd on public.%1$s for update to authenticated
        using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));', t);
    execute format('create policy %1$s_del on public.%1$s for delete to authenticated
        using (owner_id = (select auth.uid()));', t);
  end loop;
end $$;

-- updated_at touch on projects
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ============================= GRANTS ======================================
-- Supabase reaches tables through the anon/authenticated roles; the RLS
-- policies above restrict WHICH rows each user can touch. Without these
-- table-level grants the API returns "permission denied for table ...".
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
