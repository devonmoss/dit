CREATE TABLE if not exists public.race_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  race_id text REFERENCES races(id) ON DELETE CASCADE,
  user_id text,
  name TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  finished BOOLEAN DEFAULT FALSE,
  finish_time BIGINT,
  error_count INTEGER DEFAULT 0,
  race_time DOUBLE PRECISION, -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);