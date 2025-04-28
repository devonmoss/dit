-- Drop all award_xp functions
DROP FUNCTION IF EXISTS award_xp(INTEGER, JSONB, TEXT, UUID);
DROP FUNCTION IF EXISTS award_xp(UUID, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS award_xp(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_details JSONB);
DROP FUNCTION IF EXISTS award_xp(p_amount INTEGER, p_details JSONB, p_reason TEXT, p_user_id UUID);

-- Create a very simple award_xp function
CREATE OR REPLACE FUNCTION award_xp(
  p_amount INTEGER,
  p_details JSONB,
  p_reason TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_old_xp INTEGER;
  v_new_xp INTEGER;
  v_result JSONB;
BEGIN
  -- Get current XP
  SELECT COALESCE(xp, 0) INTO v_old_xp
  FROM profiles
  WHERE id = p_user_id;
  
  -- Default to 0 if not found
  IF v_old_xp IS NULL THEN
    v_old_xp := 0;
  END IF;
  
  -- Calculate new XP
  v_new_xp := v_old_xp + p_amount;
  
  -- Update profile with new XP
  UPDATE profiles
  SET xp = v_new_xp
  WHERE id = p_user_id;
  
  -- Record XP history
  INSERT INTO xp_history (user_id, amount, reason, details)
  VALUES (p_user_id, p_amount, p_reason, p_details);
  
  -- Prepare result
  v_result := jsonb_build_object(
    'old_xp', v_old_xp,
    'new_xp', v_new_xp,
    'awarded', p_amount
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;