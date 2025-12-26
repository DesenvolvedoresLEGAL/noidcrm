-- Phase 4: Intelligent Gamification - Dynamic Missions

-- 4.1 Create dynamic_missions table for personalized missions
CREATE TABLE public.dynamic_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('gap_close', 'streak_build', 'skill_develop', 'pipeline_improve', 'activity_boost')),
  target_score TEXT, -- 'CS', 'BS', 'DS', 'RAS'
  current_value NUMERIC(5,2),
  target_value NUMERIC(5,2),
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL,
  xp_weighted NUMERIC(8,2), -- XP ponderado pelo peso da atividade
  activity_weight NUMERIC(3,2) DEFAULT 1.0, -- Peso da atividade (1.0 = normal)
  is_gap_correction BOOLEAN DEFAULT false, -- Se é missão de correção de gap
  expires_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  progress_history JSONB DEFAULT '[]', -- Histórico de progresso
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dynamic_missions ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing user_is_org_member function
CREATE POLICY "Users can view their organization's dynamic missions"
ON public.dynamic_missions FOR SELECT
USING (user_is_org_member(organization_id));

CREATE POLICY "Users can insert dynamic missions for their organization"
ON public.dynamic_missions FOR INSERT
WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Users can update dynamic missions for their organization"
ON public.dynamic_missions FOR UPDATE
USING (user_is_org_member(organization_id));

-- Create indexes
CREATE INDEX idx_dynamic_missions_seller ON public.dynamic_missions(seller_id);
CREATE INDEX idx_dynamic_missions_org ON public.dynamic_missions(organization_id);
CREATE INDEX idx_dynamic_missions_active ON public.dynamic_missions(seller_id, completed, expires_at) WHERE NOT completed;
CREATE INDEX idx_dynamic_missions_type ON public.dynamic_missions(mission_type);

-- Function to calculate weighted XP
CREATE OR REPLACE FUNCTION calculate_weighted_xp(
  p_base_xp INTEGER,
  p_activity_weight NUMERIC DEFAULT 1.0,
  p_is_gap_correction BOOLEAN DEFAULT false
) RETURNS NUMERIC AS $$
BEGIN
  -- XP = base_xp * peso_atividade * multiplicador_correção
  RETURN p_base_xp * COALESCE(p_activity_weight, 1.0) * (CASE WHEN p_is_gap_correction THEN 1.5 ELSE 1.0 END);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate dynamic missions for a seller based on their performance
CREATE OR REPLACE FUNCTION generate_dynamic_missions(p_seller_id UUID)
RETURNS SETOF public.dynamic_missions AS $$
DECLARE
  v_org_id UUID;
  v_scores RECORD;
  v_mission RECORD;
BEGIN
  -- Get seller's organization
  SELECT organization_id INTO v_org_id FROM public.sellers WHERE id = p_seller_id;
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get seller's performance scores
  SELECT cs_final, bs_final, ds_final, ras_final
  INTO v_scores
  FROM public.seller_performance_scores
  WHERE seller_id = p_seller_id
  ORDER BY calculated_at DESC
  LIMIT 1;
  
  -- Generate gap-close missions based on low scores
  IF v_scores IS NOT NULL THEN
    -- BS gap mission (if BS < 70)
    IF COALESCE(v_scores.bs_final, 0) < 70 THEN
      INSERT INTO public.dynamic_missions (
        seller_id, mission_type, target_score, current_value, target_value,
        description, xp_reward, xp_weighted, activity_weight, is_gap_correction,
        expires_at, organization_id
      ) VALUES (
        p_seller_id, 'gap_close', 'BS', v_scores.bs_final, 
        LEAST(v_scores.bs_final + 10, 75),
        'Aumente seu BS de ' || ROUND(v_scores.bs_final, 1) || ' → ' || ROUND(LEAST(v_scores.bs_final + 10, 75), 1) || ' em 7 dias',
        100, 150, 1.0, true,
        NOW() + INTERVAL '7 days', v_org_id
      )
      ON CONFLICT DO NOTHING
      RETURNING * INTO v_mission;
      IF FOUND THEN RETURN NEXT v_mission; END IF;
    END IF;
    
    -- CS gap mission (if CS < 65)
    IF COALESCE(v_scores.cs_final, 0) < 65 THEN
      INSERT INTO public.dynamic_missions (
        seller_id, mission_type, target_score, current_value, target_value,
        description, xp_reward, xp_weighted, activity_weight, is_gap_correction,
        expires_at, organization_id
      ) VALUES (
        p_seller_id, 'gap_close', 'CS', v_scores.cs_final, 
        LEAST(v_scores.cs_final + 8, 70),
        'Aumente seu CS de ' || ROUND(v_scores.cs_final, 1) || ' → ' || ROUND(LEAST(v_scores.cs_final + 8, 70), 1) || ' em 7 dias',
        100, 150, 1.0, true,
        NOW() + INTERVAL '7 days', v_org_id
      )
      ON CONFLICT DO NOTHING
      RETURNING * INTO v_mission;
      IF FOUND THEN RETURN NEXT v_mission; END IF;
    END IF;
    
    -- DS gap mission (if DS < 50)
    IF COALESCE(v_scores.ds_final, 0) < 50 THEN
      INSERT INTO public.dynamic_missions (
        seller_id, mission_type, target_score, current_value, target_value,
        description, xp_reward, xp_weighted, activity_weight, is_gap_correction,
        expires_at, organization_id
      ) VALUES (
        p_seller_id, 'gap_close', 'DS', v_scores.ds_final, 
        LEAST(v_scores.ds_final + 15, 60),
        'Reduza o aging do pipeline - DS de ' || ROUND(v_scores.ds_final, 1) || ' → ' || ROUND(LEAST(v_scores.ds_final + 15, 60), 1) || ' em 7 dias',
        120, 180, 1.2, true,
        NOW() + INTERVAL '7 days', v_org_id
      )
      ON CONFLICT DO NOTHING
      RETURNING * INTO v_mission;
      IF FOUND THEN RETURN NEXT v_mission; END IF;
    END IF;
  END IF;
  
  -- Skill development missions
  INSERT INTO public.dynamic_missions (
    seller_id, mission_type, target_score, current_value, target_value,
    description, xp_reward, xp_weighted, activity_weight, is_gap_correction,
    expires_at, organization_id
  ) VALUES (
    p_seller_id, 'skill_develop', NULL, 0, 3,
    'Complete 3 roleplays com nota ≥ 8',
    100, 100, 1.0, false,
    NOW() + INTERVAL '7 days', v_org_id
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_mission;
  IF FOUND THEN RETURN NEXT v_mission; END IF;
  
  -- Streak build mission
  INSERT INTO public.dynamic_missions (
    seller_id, mission_type, target_score, current_value, target_value,
    description, xp_reward, xp_weighted, activity_weight, is_gap_correction,
    expires_at, organization_id
  ) VALUES (
    p_seller_id, 'streak_build', NULL, 0, 5,
    'Mantenha streak de 5 dias de atividade',
    80, 80, 1.0, false,
    NOW() + INTERVAL '10 days', v_org_id
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_mission;
  IF FOUND THEN RETURN NEXT v_mission; END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check and complete dynamic missions
CREATE OR REPLACE FUNCTION check_dynamic_mission_completion(p_seller_id UUID)
RETURNS TABLE (
  mission_id UUID,
  mission_type TEXT,
  xp_earned NUMERIC
) AS $$
DECLARE
  v_mission RECORD;
  v_current_value NUMERIC;
  v_scores RECORD;
  v_streak INTEGER;
  v_roleplay_count INTEGER;
BEGIN
  -- Get latest scores
  SELECT cs_final, bs_final, ds_final, ras_final
  INTO v_scores
  FROM public.seller_performance_scores
  WHERE seller_id = p_seller_id
  ORDER BY calculated_at DESC
  LIMIT 1;
  
  -- Get current streak
  SELECT COALESCE(current_streak, 0) INTO v_streak
  FROM public.sellers WHERE id = p_seller_id;
  
  -- Get recent roleplay count with score >= 8
  SELECT COUNT(*) INTO v_roleplay_count
  FROM public.roleplay_sessions
  WHERE seller_id = p_seller_id
    AND finished_at >= NOW() - INTERVAL '7 days'
    AND score_overall >= 8;
  
  -- Check each active mission
  FOR v_mission IN 
    SELECT * FROM public.dynamic_missions
    WHERE seller_id = p_seller_id
      AND NOT completed
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    v_current_value := NULL;
    
    -- Determine current value based on mission type
    CASE v_mission.target_score
      WHEN 'CS' THEN v_current_value := v_scores.cs_final;
      WHEN 'BS' THEN v_current_value := v_scores.bs_final;
      WHEN 'DS' THEN v_current_value := v_scores.ds_final;
      WHEN 'RAS' THEN v_current_value := v_scores.ras_final;
      ELSE
        -- Non-score missions
        IF v_mission.mission_type = 'streak_build' THEN
          v_current_value := v_streak;
        ELSIF v_mission.mission_type = 'skill_develop' THEN
          v_current_value := v_roleplay_count;
        END IF;
    END CASE;
    
    -- Update current value
    IF v_current_value IS NOT NULL THEN
      UPDATE public.dynamic_missions
      SET current_value = v_current_value,
          updated_at = NOW(),
          progress_history = progress_history || jsonb_build_object(
            'value', v_current_value,
            'timestamp', NOW()
          )
      WHERE id = v_mission.id;
      
      -- Check completion
      IF v_current_value >= v_mission.target_value THEN
        UPDATE public.dynamic_missions
        SET completed = true,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_mission.id;
        
        -- Return completed mission info
        mission_id := v_mission.id;
        mission_type := v_mission.mission_type;
        xp_earned := COALESCE(v_mission.xp_weighted, v_mission.xp_reward);
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update timestamp trigger
CREATE TRIGGER update_dynamic_missions_updated_at
  BEFORE UPDATE ON public.dynamic_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_dynamic_missions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_weighted_xp(INTEGER, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION check_dynamic_mission_completion(UUID) TO authenticated;