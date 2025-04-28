-- Drop existing function if it exists
DROP FUNCTION IF EXISTS award_xp(INTEGER, JSONB, TEXT, UUID);

-- Ensure profiles table has XP columns (in case the original migration failed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp') THEN
    ALTER TABLE profiles ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'level') THEN
    ALTER TABLE profiles ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Create the xp_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Set up RLS for xp_history if not already done
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Users can view own xp history" ON xp_history;
DROP POLICY IF EXISTS "Allow system to insert XP history" ON xp_history;

-- Create policies
CREATE POLICY "Users can view own xp history" ON xp_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow system to insert XP history" ON xp_history
  FOR INSERT
  WITH CHECK (true);

-- Create the function with the correct parameter order
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_old_xp INTEGER;
  v_new_xp INTEGER;
  v_result JSONB;
BEGIN
  -- Get current XP and level
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
  
  IF v_new_level IS NULL THEN
    -- Default to level 1 if no level matches
    v_new_level := 1;
  END IF;
  
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