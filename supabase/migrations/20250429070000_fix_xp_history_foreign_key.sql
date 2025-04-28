-- Create the xp_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drop the foreign key constraint if it exists
ALTER TABLE xp_history DROP CONSTRAINT IF EXISTS xp_history_user_id_fkey;

-- Add the corrected foreign key constraint pointing to profiles instead of auth.users
ALTER TABLE xp_history ADD CONSTRAINT xp_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Update the award_xp function to handle this change
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_profile_exists BOOLEAN;
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_old_xp INTEGER;
  v_new_xp INTEGER;
  v_result JSONB;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) INTO v_profile_exists;
  
  -- If profile doesn't exist, create it with default values
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (id, xp, level)
    VALUES (p_user_id, 0, 1)
    RETURNING xp, level INTO v_old_xp, v_old_level;
  ELSE
    -- Get current XP and level
    SELECT xp, level INTO v_old_xp, v_old_level
    FROM profiles
    WHERE id = p_user_id;
  END IF;
  
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
  BEGIN
    INSERT INTO xp_history (user_id, amount, reason, details)
    VALUES (p_user_id, p_amount, p_reason, p_details);
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but continue execution
    RAISE WARNING 'Could not insert XP history: %', SQLERRM;
  END;
  
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