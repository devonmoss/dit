create table if not exists public.answers (
  id bigserial primary key,
  race_id text not null references public.races(id) on delete cascade,
  user_id text,
  username text,
  char text not null,
  answer text not null,
  correct boolean not null,
  time_ms integer not null,
  created_at timestamptz not null default now()
);