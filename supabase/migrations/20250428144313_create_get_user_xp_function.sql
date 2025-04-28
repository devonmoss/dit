CREATE OR REPLACE FUNCTION get_user_xp_info(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile_exists BOOLEAN;
  v_xp INTEGER;
  v_level INTEGER;
  v_result JSONB;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = user_id) INTO v_profile_exists;
  
  -- If profile doesn't exist, create it with default values
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (id, xp, level)
    VALUES (user_id, 0, 1)
    RETURNING xp, level INTO v_xp, v_level;
  ELSE
    -- Get existing profile data
    SELECT xp, level INTO v_xp, v_level
    FROM profiles
    WHERE id = user_id;
  END IF;
  
  -- Ensure we have values even if NULL was returned
  IF v_xp IS NULL THEN
    v_xp := 0;
  END IF;
  
  IF v_level IS NULL THEN
    v_level := 1;
  END IF;
  
  -- Get title from xp_levels
  DECLARE
    v_title TEXT;
  BEGIN
    SELECT title INTO v_title
    FROM xp_levels
    WHERE level = v_level;
    
    IF v_title IS NULL THEN
      v_title := 'Beginner';
    END IF;
    
    -- Build result object
    v_result := jsonb_build_object(
      'user_id', user_id,
      'xp', v_xp,
      'level', v_level,
      'title', v_title
    );
  END;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;