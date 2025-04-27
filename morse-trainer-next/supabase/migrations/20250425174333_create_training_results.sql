-- supabase/migrations/20250425174333_create_training_results.sql
-- Create the 'training_results' table for results of training sessions

create table if not exists public.training_results (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  mode text not null check (mode in ('copy','send')),
  level_id text not null,
  time_sec float8 not null,
  tone_replays int4,
  mistakes jsonb,
  created_at timestamptz not null default now(),
  times jsonb
);

ALTER TABLE public.training_results ENABLE ROW LEVEL SECURITY;

create policy "Enable insert for users based on user_id"
on "public"."training_results" 
as permissive
for insert
to public
with check (
 (( SELECT auth.uid() AS uid) = user_id)
);

create policy "Enable users to view their own data only"
on "public"."training_results"
as permissive
for select
to authenticated
using (
  (( SELECT auth.uid() AS uid) = user_id)
);

