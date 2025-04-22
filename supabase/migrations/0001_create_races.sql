-- supabase/migrations/0001_create_races.sql
-- Create the 'races' table for real-time Morse code race sessions

-- Races table tracks each race session
create table if not exists public.races (
  id text primary key,
  mode text not null check (mode in ('copy','send')),
  status text not null default 'lobby',
  sequence text[] not null default '{}',
  start_time timestamptz,
  created_at timestamptz not null default now()
);