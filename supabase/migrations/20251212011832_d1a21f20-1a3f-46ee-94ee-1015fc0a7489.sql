-- Função para contar leads por grade (bypassa limite de 1000 registros)
CREATE OR REPLACE FUNCTION count_leads_by_grade()
RETURNS TABLE (grade TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT 
    COALESCE(lead_grade, 'F') as grade,
    COUNT(*) as count
  FROM accounts
  WHERE organization_id = get_user_organization_id()
  GROUP BY lead_grade
  ORDER BY grade;
$$;

-- Função para contar oportunidades por faixa de score
CREATE OR REPLACE FUNCTION count_opportunities_by_score_range()
RETURNS TABLE (score_range TEXT, count BIGINT, avg_score NUMERIC)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT 
    CASE 
      WHEN opportunity_score >= 70 THEN 'high'
      WHEN opportunity_score >= 40 THEN 'medium'
      ELSE 'low'
    END as score_range,
    COUNT(*) as count,
    ROUND(AVG(opportunity_score)::numeric, 1) as avg_score
  FROM opportunities
  WHERE organization_id = get_user_organization_id()
    AND status = 'open'
    AND opportunity_score IS NOT NULL
  GROUP BY 
    CASE 
      WHEN opportunity_score >= 70 THEN 'high'
      WHEN opportunity_score >= 40 THEN 'medium'
      ELSE 'low'
    END;
$$;

-- Função para obter resumo completo de scoring
CREATE OR REPLACE FUNCTION get_scoring_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
  org_id UUID;
BEGIN
  org_id := get_user_organization_id();
  
  SELECT json_build_object(
    'lead_grades', (
      SELECT json_object_agg(COALESCE(lead_grade, 'F'), cnt)
      FROM (
        SELECT lead_grade, COUNT(*) as cnt
        FROM accounts
        WHERE organization_id = org_id
        GROUP BY lead_grade
      ) grades
    ),
    'total_accounts', (
      SELECT COUNT(*) FROM accounts WHERE organization_id = org_id
    ),
    'accounts_with_score', (
      SELECT COUNT(*) FROM accounts WHERE organization_id = org_id AND lead_score IS NOT NULL
    ),
    'opportunity_scores', (
      SELECT json_build_object(
        'high', COUNT(*) FILTER (WHERE opportunity_score >= 70),
        'medium', COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70),
        'low', COUNT(*) FILTER (WHERE opportunity_score < 40),
        'avg_score', ROUND(AVG(opportunity_score)::numeric, 1)
      )
      FROM opportunities
      WHERE organization_id = org_id AND status = 'open' AND opportunity_score IS NOT NULL
    ),
    'total_opportunities', (
      SELECT COUNT(*) FROM opportunities WHERE organization_id = org_id AND status = 'open'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Trigger para sincronizar lead_grade quando lead_score mudar
CREATE OR REPLACE FUNCTION sync_lead_grade_from_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Calcula o grade baseado no score
  IF NEW.lead_score IS NULL THEN
    NEW.lead_grade := NULL;
  ELSIF NEW.lead_score >= 80 THEN
    NEW.lead_grade := 'A';
  ELSIF NEW.lead_score >= 60 THEN
    NEW.lead_grade := 'B';
  ELSIF NEW.lead_score >= 40 THEN
    NEW.lead_grade := 'C';
  ELSIF NEW.lead_score >= 20 THEN
    NEW.lead_grade := 'D';
  ELSE
    NEW.lead_grade := 'F';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_sync_lead_grade ON accounts;
CREATE TRIGGER trigger_sync_lead_grade
  BEFORE INSERT OR UPDATE OF lead_score ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_grade_from_score();

-- Corrigir grades inconsistentes existentes
UPDATE accounts
SET lead_grade = CASE 
  WHEN lead_score >= 80 THEN 'A'
  WHEN lead_score >= 60 THEN 'B'
  WHEN lead_score >= 40 THEN 'C'
  WHEN lead_score >= 20 THEN 'D'
  ELSE 'F'
END
WHERE lead_score IS NOT NULL
  AND (
    lead_grade IS NULL 
    OR lead_grade != CASE 
      WHEN lead_score >= 80 THEN 'A'
      WHEN lead_score >= 60 THEN 'B'
      WHEN lead_score >= 40 THEN 'C'
      WHEN lead_score >= 20 THEN 'D'
      ELSE 'F'
    END
  );