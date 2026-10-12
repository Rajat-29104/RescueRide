create table public.driver_vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  make text not null check (char_length(trim(make)) > 0),
  model text not null check (char_length(trim(model)) > 0),
  year integer not null check (year between 1900 and 2100),
  color text not null check (char_length(trim(color)) > 0),
  plate text not null check (char_length(trim(plate)) > 0),
  vin text,
  registration_expiry date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_driver_vehicles_driver_plate
on public.driver_vehicles(driver_id, lower(trim(plate)));

create index idx_driver_vehicles_driver_id
on public.driver_vehicles(driver_id);

alter table public.driver_vehicles enable row level security;

create policy "drivers manage own vehicles"
on public.driver_vehicles
for all
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

create policy "admins can view all vehicles"
on public.driver_vehicles
for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role = 'admin'
));

create trigger set_driver_vehicles_updated_at
before update on public.driver_vehicles
for each row
execute procedure public.set_updated_at();
