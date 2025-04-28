-- Check if xp_levels has a title column, add it if not
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'xp_levels' AND column_name = 'title') THEN
    ALTER TABLE xp_levels ADD COLUMN title TEXT NOT NULL DEFAULT 'Beginner';
  END IF;
  
  -- Rename tier to title if tier exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'xp_levels' AND column_name = 'tier') THEN
    ALTER TABLE xp_levels RENAME COLUMN tier TO title;
  END IF;
END $$;

-- Update the profiles RLS policy to allow users to update their own profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies 
DROP POLICY IF EXISTS "Users can view any profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new RLS policies
CREATE POLICY "Users can view any profile" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Update award_xp function to ensure required columns exist
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
  -- Ensure XP levels table has data
  IF NOT EXISTS (SELECT 1 FROM xp_levels) THEN
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
    ON CONFLICT (level) DO NOTHING;
  END IF;

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
  
  -- Print debug information
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