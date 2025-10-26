-- Fix check_meeting_unlock function search_path
CREATE OR REPLACE FUNCTION check_meeting_unlock()
RETURNS TRIGGER AS $$
DECLARE
  v_attendance BOOLEAN;
BEGIN
  IF NEW.score_overall >= 8.0 AND NEW.passed = true AND NEW.finished_at IS NOT NULL THEN
    SELECT present INTO v_attendance
    FROM public.attendance
    WHERE seller_id = NEW.seller_id 
    AND date = (NEW.finished_at AT TIME ZONE 'America/Sao_Paulo')::date;
    
    IF v_attendance = true THEN
      NEW.meeting_unlocked := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;