-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  color text not null default '#c9847a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Events viewable by all authenticated"
  on public.events for select to authenticated using (true);

create policy "Users can insert own events"
  on public.events for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update to authenticated using (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.events for delete to authenticated using (auth.uid() = user_id);

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create index events_starts_at_idx on public.events(starts_at);

-- NOTES
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can view own notes"
  on public.notes for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update to authenticated using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete to authenticated using (auth.uid() = user_id);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create index notes_user_id_idx on public.notes(user_id);
create index notes_event_id_idx on public.notes(event_id);

-- =========================================================
-- ROLES / ADMIN SYSTEM
-- =========================================================

create type public.app_role as enum (
  'admin',
  'user',
  'padre',
  'coordenacao',
  'coordenador'
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),

  unique(user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(
  _user_id uuid,
  _role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role)
from public;

grant execute on function public.has_role(uuid, public.app_role)
to authenticated;

create policy "Users can view own roles"
on public.user_roles
for select
to authenticated
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

create policy "Admins can insert roles"
on public.user_roles
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
);

create policy "Admins can update roles"
on public.user_roles
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
)
with check (
  public.has_role(auth.uid(), 'admin')
);

create policy "Admins can delete roles"
on public.user_roles
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
);

-- =========================================================
-- CREATE FIRST ADMIN USER
-- =========================================================

insert into public.user_roles (user_id, role)
values (
  '1cde0cf4-b7b0-4391-a24b-b23cb9482e71',
  'admin'
);