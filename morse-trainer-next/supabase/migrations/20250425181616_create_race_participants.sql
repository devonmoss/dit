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

-- Create policies for different operations
-- Allow reads for all users (including anonymous)
CREATE POLICY "Allow reads for all users" ON public.race_participants
  FOR SELECT USING (true);

-- Allow anonymous users to insert races (they'll still get an auth.uid)
CREATE POLICY "Allow inserts for all users" ON public.race_participants
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update races for realtime functionality
-- In a production app, you might want more specific conditions
CREATE POLICY "Allow updates for all users" ON public.race_participants
  FOR UPDATE USING (true);

-- Prevent deletion for all users
CREATE POLICY "Prevent deletion for all users" ON public.race_participants
  FOR DELETE USING (false);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.race_participants;