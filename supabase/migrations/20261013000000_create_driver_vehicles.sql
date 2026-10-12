-- Additive vehicle storage for the Java backend. Existing tables and data are untouched.
create table if not exists public.driver_vehicles (
    id uuid primary key default gen_random_uuid(),
    driver_id uuid not null references public.profiles(id) on delete cascade,
    make text not null,
    model text not null,
    year integer not null check (year between 1900 and 2100),
    color text not null,
    plate text not null,
    vin varchar(17),
    registration_expiry date,
    notes text,
    is_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint driver_vehicles_vin_format check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{8,17}$')
);

create unique index if not exists driver_vehicles_driver_active_plate_key
    on public.driver_vehicles (driver_id, upper(plate))
    where is_archived = false;

create index if not exists idx_driver_vehicles_driver_active
    on public.driver_vehicles (driver_id, updated_at desc)
    where is_archived = false;

drop trigger if exists trg_driver_vehicles_updated_at on public.driver_vehicles;
create trigger trg_driver_vehicles_updated_at
    before update on public.driver_vehicles
    for each row execute function public.set_updated_at();

alter table public.driver_vehicles enable row level security;

drop policy if exists driver_vehicles_owner_access on public.driver_vehicles;
create policy driver_vehicles_owner_access on public.driver_vehicles
    for all to authenticated
    using (driver_id = auth.uid())
    with check (driver_id = auth.uid());
