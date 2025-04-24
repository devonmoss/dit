
CREATE TABLE if not exists public.races (
  id text primary key,
  created_by uuid,
  status TEXT CHECK (status IN ('waiting', 'countdown', 'racing', 'finished')),
  mode text not null check (mode in ('copy','send')),
  char_sequence text[] not null default '{}',
  text TEXT NOT NULL,
  level_id text,
  start_time BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);