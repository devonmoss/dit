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

-- Create policies for different operations
-- Allow reads for all users (including anonymous)
CREATE POLICY "Allow reads for all users" ON public.races
  FOR SELECT USING (true);

-- Allow anonymous users to insert races (they'll still get an auth.uid)
CREATE POLICY "Allow inserts for all users" ON public.races
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update races for realtime functionality
-- In a production app, you might want more specific conditions
CREATE POLICY "Allow updates for all users" ON public.races
  FOR UPDATE USING (true);

-- Prevent deletion for all users
CREATE POLICY "Prevent deletion for all users" ON public.races
  FOR DELETE USING (false);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.races;