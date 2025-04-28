-- Drop all versions of the award_xp function
DROP FUNCTION IF EXISTS award_xp(INTEGER, JSONB, TEXT, UUID);
DROP FUNCTION IF EXISTS award_xp(UUID, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS award_xp(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_details JSONB);
DROP FUNCTION IF EXISTS award_xp(p_amount INTEGER, p_details JSONB, p_reason TEXT, p_user_id UUID);

-- Make sure xp_levels table exists and has data
CREATE TABLE IF NOT EXISTS xp_levels (
  level INTEGER PRIMARY KEY,
  required_xp INTEGER NOT NULL,
  title TEXT NOT NULL
);

-- Insert default level thresholds if they don't exist
INSERT INTO xp_levels (level, required_xp, title)
VALUES 
  (1, 0, 'Beginner'),
  (2, 100, 'Novice'),
  (3, 300, 'Apprentice'), 
  (4, 600, 'Journeyman'),
  (5, 1000, 'Expert'),
  (6, 1500, 'Master'),
  (7, 2100, 'Grandmaster'),
  (8, 2800, 'Legend'),
  (9, 3600, 'Mythic'),
  (10, 4500, 'Transcendent')
ON CONFLICT (level) DO UPDATE
SET required_xp = EXCLUDED.required_xp,
    title = EXCLUDED.title;

-- Create the final version of award_xp function
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
  
  -- Default to 0 and 1 if NULL (new profile)
  IF v_old_xp IS NULL THEN
    v_old_xp := 0;
  END IF;
  
  IF v_old_level IS NULL THEN
    v_old_level := 1;
  END IF;
  
  -- Calculate new XP
  v_new_xp := v_old_xp + p_amount;
  
  -- Determine new level based on XP
  SELECT level INTO v_new_level
  FROM xp_levels
  WHERE required_xp <= v_new_xp
  ORDER BY level DESC
  LIMIT 1;
  
  -- Default to level 1 if no level matches
  IF v_new_level IS NULL THEN
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
  
  -- Debug log to show what's happening
  RAISE NOTICE 'XP Update: user=%, old_xp=%, new_xp=%, old_level=%, new_level=%', 
               p_user_id, v_old_xp, v_new_xp, v_old_level, v_new_level;
  
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