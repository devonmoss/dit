-- Add XP and level columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- Create XP history table to track XP transactions
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Set up Row Level Security (RLS) for xp_history
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;

-- Create policies for xp_history
CREATE POLICY "Users can view own xp history" ON xp_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- XP thresholds for each level
CREATE TABLE IF NOT EXISTS xp_levels (
  level INTEGER PRIMARY KEY,
  required_xp INTEGER NOT NULL,
  tier TEXT NOT NULL
);

-- Insert level thresholds
INSERT INTO xp_levels (level, required_xp, tier) VALUES
-- Novice tier (levels 1-5)
(1, 0, 'Novice'),
(2, 100, 'Novice'),
(3, 250, 'Novice'),
(4, 450, 'Novice'),
(5, 700, 'Novice'),
-- Apprentice tier (levels 6-10)
(6, 1000, 'Apprentice'),
(7, 1400, 'Apprentice'),
(8, 1900, 'Apprentice'),
(9, 2500, 'Apprentice'),
(10, 3200, 'Apprentice'),
-- Operator tier (levels 11-15)
(11, 4000, 'Operator'),
(12, 5000, 'Operator'),
(13, 6200, 'Operator'),
(14, 7600, 'Operator'),
(15, 9200, 'Operator'),
-- Expert tier (levels 16-20)
(16, 11000, 'Expert'),
(17, 13000, 'Expert'),
(18, 15500, 'Expert'),
(19, 18500, 'Expert'),
(20, 22000, 'Expert'),
-- Master tier (levels 21-25)
(21, 26000, 'Master'),
(22, 31000, 'Master'),
(23, 37000, 'Master'),
(24, 44000, 'Master'),
(25, 52000, 'Master'),
-- Legend tier (levels 26-30)
(26, 61000, 'Legend'),
(27, 71000, 'Legend'),
(28, 82000, 'Legend'),
(29, 94000, 'Legend'),
(30, 110000, 'Legend');

-- Function to award XP and handle level-ups
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