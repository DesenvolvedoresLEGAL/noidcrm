-- Sprint 2: Lifecycle Automático da Account + Métricas Separadas

-- 1. Adicionar campo qualified_at na accounts para rastrear quando virou SQL
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'Lead';

-- 2. Criar função para atualizar lifecycle da account quando oportunidade é qualificada
CREATE OR REPLACE FUNCTION public.update_account_lifecycle_on_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Quando uma oportunidade é duplicada com qualified_at preenchido (veio de PRÉ VENDAS)
  IF NEW.qualified_at IS NOT NULL AND NEW.source_opportunity_id IS NOT NULL AND NEW.account_id IS NOT NULL THEN
    UPDATE accounts
    SET 
      lifecycle_stage = CASE 
        WHEN lifecycle_stage IN ('Lead', 'MQL') THEN 'SQL'
        ELSE lifecycle_stage
      END,
      qualified_at = COALESCE(qualified_at, NEW.qualified_at),
      tipo_empresa = CASE 
        WHEN tipo_empresa IS NULL OR tipo_empresa = '' OR tipo_empresa = 'Lead' THEN 'Prospect'
        ELSE tipo_empresa
      END,
      intent_score = LEAST(intent_score + 20, 100), -- Boost intent score
      updated_at = NOW()
    WHERE id = NEW.account_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Criar função para atualizar lifecycle da account quando deal é ganho
CREATE OR REPLACE FUNCTION public.update_account_lifecycle_on_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_pipeline_type TEXT;
BEGIN
  -- Apenas quando status muda para 'won'
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    -- Verificar se é um pipeline de vendas (não de qualificação)
    SELECT pipeline_type INTO v_pipeline_type
    FROM pipelines
    WHERE id = NEW.pipeline_id;
    
    -- Apenas atualiza para Cliente se for pipeline de vendas
    IF v_pipeline_type = 'sales' AND NEW.account_id IS NOT NULL THEN
      UPDATE accounts
      SET 
        lifecycle_stage = 'Cliente',
        tipo_empresa = 'Cliente',
        data_tornou_cliente = COALESCE(data_tornou_cliente, CURRENT_DATE),
        updated_at = NOW()
      WHERE id = NEW.account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar triggers
DROP TRIGGER IF EXISTS trigger_account_lifecycle_on_qualification ON opportunities;
CREATE TRIGGER trigger_account_lifecycle_on_qualification
AFTER INSERT ON opportunities
FOR EACH ROW
EXECUTE FUNCTION update_account_lifecycle_on_qualification();

DROP TRIGGER IF EXISTS trigger_account_lifecycle_on_won ON opportunities;
CREATE TRIGGER trigger_account_lifecycle_on_won
AFTER UPDATE OF status ON opportunities
FOR EACH ROW
EXECUTE FUNCTION update_account_lifecycle_on_won();

-- 5. Criar view para métricas de qualificação vs vendas
CREATE OR REPLACE VIEW public.pipeline_metrics AS
SELECT 
  p.id as pipeline_id,
  p.name as pipeline_name,
  p.pipeline_type,
  p.organization_id,
  COUNT(o.id) as total_opportunities,
  COUNT(CASE WHEN o.status = 'won' THEN 1 END) as won_count,
  COUNT(CASE WHEN o.status = 'lost' THEN 1 END) as lost_count,
  COUNT(CASE WHEN o.status IS NULL OR o.status NOT IN ('won', 'lost') THEN 1 END) as active_count,
  COALESCE(SUM(o.valor_previsto), 0) as total_value,
  COALESCE(SUM(CASE WHEN o.status = 'won' THEN o.valor_previsto ELSE 0 END), 0) as won_value,
  COALESCE(AVG(CASE WHEN o.status = 'won' THEN o.valor_previsto END), 0) as avg_won_value,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN o.status IN ('won', 'lost') THEN 1 END) > 0 
      THEN COUNT(CASE WHEN o.status = 'won' THEN 1 END)::NUMERIC / 
           COUNT(CASE WHEN o.status IN ('won', 'lost') THEN 1 END) * 100
      ELSE 0 
    END, 2
  ) as win_rate
FROM pipelines p
LEFT JOIN opportunities o ON o.pipeline_id = p.id
GROUP BY p.id, p.name, p.pipeline_type, p.organization_id;

-- 6. Criar view para SDR Performance
CREATE OR REPLACE VIEW public.sdr_performance AS
SELECT 
  o.qualified_by_user_id as sdr_user_id,
  pr.full_name as sdr_name,
  o.organization_id,
  COUNT(DISTINCT o.id) as total_sqls_generated,
  COUNT(DISTINCT CASE WHEN o.status = 'won' THEN o.id END) as deals_won,
  COUNT(DISTINCT CASE WHEN o.status = 'lost' THEN o.id END) as deals_lost,
  COALESCE(SUM(CASE WHEN o.status = 'won' THEN o.valor_previsto ELSE 0 END), 0) as revenue_attributed,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN o.status IN ('won', 'lost') THEN o.id END) > 0 
      THEN COUNT(DISTINCT CASE WHEN o.status = 'won' THEN o.id END)::NUMERIC / 
           COUNT(DISTINCT CASE WHEN o.status IN ('won', 'lost') THEN o.id END) * 100
      ELSE 0 
    END, 2
  ) as conversion_rate,
  AVG(EXTRACT(EPOCH FROM (o.qualified_at - source.created_at)) / 3600)::NUMERIC(10,2) as avg_qualification_hours
FROM opportunities o
LEFT JOIN profiles pr ON pr.user_id = o.qualified_by_user_id
LEFT JOIN opportunities source ON source.id = o.source_opportunity_id
WHERE o.qualified_by_user_id IS NOT NULL
GROUP BY o.qualified_by_user_id, pr.full_name, o.organization_id;

-- 7. Comentários
COMMENT ON VIEW public.pipeline_metrics IS 'Métricas agregadas por pipeline separando qualificação de vendas';
COMMENT ON VIEW public.sdr_performance IS 'Performance de SDRs: SQLs gerados, deals fechados, receita atribuída';