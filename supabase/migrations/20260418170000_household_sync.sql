-- Household console: JSON snapshot + RPC-only anon access.
-- sync_key is a shared household secret (treat like a password).

create table if not exists public.household_snapshots (
  sync_key text primary key check (char_length(sync_key) >= 20),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.household_snapshots enable row level security;

revoke all on public.household_snapshots from anon, authenticated;
grant select, insert, update, delete on public.household_snapshots to service_role;

create or replace function public.household_pull(k text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select hs.payload
  from public.household_snapshots hs
  where hs.sync_key = k
    and char_length(k) >= 20;
$$;

create or replace function public.household_push(k text, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if k is null or char_length(k) < 20 then
    raise exception 'invalid sync key';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'invalid payload';
  end if;
  insert into public.household_snapshots (sync_key, payload)
  values (k, p)
  on conflict (sync_key) do update
    set payload = excluded.payload,
        updated_at = now();
end;
$$;

grant execute on function public.household_pull(text) to anon;
grant execute on function public.household_push(text, jsonb) to anon;

comment on table public.household_snapshots is 'Household JSON blob; only reachable via household_pull/household_push RPC for anon.';
