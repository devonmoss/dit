-- Create an XP history table to track XP gains
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'training', 'race', etc.
  details JSONB, -- Additional context about the XP gain
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Set up RLS policies for xp_history
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own XP history
CREATE POLICY "Users can view own XP history" ON xp_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow system to insert XP history for any user
CREATE POLICY "Allow system to insert XP history" ON xp_history
  FOR INSERT
  WITH CHECK (true);
