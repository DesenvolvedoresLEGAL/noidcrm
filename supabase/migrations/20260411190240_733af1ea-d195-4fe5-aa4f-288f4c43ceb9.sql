
CREATE OR REPLACE FUNCTION public.calculate_weighted_xp(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total_xp INTEGER := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN
    SELECT 
      ua.achievement_id,
      a.xp_reward,
      ua.times_earned
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = p_user_id
      AND a.organization_id = p_organization_id
      AND a.is_active = true
  LOOP
    v_total_xp := v_total_xp + (v_record.xp_reward * COALESCE(v_record.times_earned, 1));
  END LOOP;

  RETURN v_total_xp;
END;
$$;
