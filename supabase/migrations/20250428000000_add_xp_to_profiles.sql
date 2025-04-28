-- Add XP and level to profiles table
ALTER TABLE profiles 
ADD COLUMN xp INTEGER NOT NULL DEFAULT 0,
ADD COLUMN level INTEGER NOT NULL DEFAULT 1;

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

-- Create XP levels table
CREATE TABLE IF NOT EXISTS xp_levels (
  level INTEGER PRIMARY KEY,
  required_xp INTEGER NOT NULL,
  title TEXT NOT NULL
);

-- Create a function to award XP and handle level-ups
CREATE OR REPLACE FUNCTION award_xp(
  p_amount INTEGER,
  p_details JSONB,
  p_reason TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_old_xp INTEGER;
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_result JSONB;
BEGIN
  -- Get current user XP and level
  SELECT xp, level INTO v_old_xp, v_old_level
  FROM profiles
  WHERE id = p_user_id;

  -- Calculate new XP
  v_new_xp := v_old_xp + p_amount;

  -- Determine new level based on XP
  SELECT level INTO v_new_level
  FROM xp_levels
  WHERE required_xp <= v_new_xp
  ORDER BY level DESC
  LIMIT 1;

  -- Update profile with new XP and level
  UPDATE profiles
  SET xp = v_new_xp,
      level = v_new_level
  WHERE id = p_user_id;

  -- Record XP history
  INSERT INTO xp_history (user_id, amount, reason, details)
  VALUES (p_user_id, p_amount, p_reason, p_details);

  -- Prepare result
  v_result := jsonb_build_object(
    'old_xp', v_old_xp,
    'new_xp', v_new_xp,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'awarded', p_amount,
    'leveled_up', v_new_level > v_old_level
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;