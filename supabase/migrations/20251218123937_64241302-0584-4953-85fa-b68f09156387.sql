-- Tabela para histórico de acurácia dos cenários
CREATE TABLE public.forecast_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  snapshot_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Cenários previstos no momento do snapshot
  pessimistic_forecast NUMERIC NOT NULL DEFAULT 0,
  realistic_forecast NUMERIC NOT NULL DEFAULT 0,
  optimistic_forecast NUMERIC NOT NULL DEFAULT 0,
  best_case_forecast NUMERIC NOT NULL DEFAULT 0,
  
  -- Deals incluídos em cada cenário (para auditoria)
  pessimistic_deal_ids TEXT[] DEFAULT '{}',
  realistic_deal_ids TEXT[] DEFAULT '{}',
  optimistic_deal_ids TEXT[] DEFAULT '{}',
  best_case_deal_ids TEXT[] DEFAULT '{}',
  
  -- Valor real (preenchido no final do período)
  actual_revenue NUMERIC,
  actual_recorded_at TIMESTAMP WITH TIME ZONE,
  
  -- Métricas de acurácia (calculadas após período)
  pessimistic_accuracy NUMERIC,
  realistic_accuracy NUMERIC,
  optimistic_accuracy NUMERIC,
  best_case_accuracy NUMERIC,
  closest_scenario TEXT,
  
  -- Metadata
  goal NUMERIC NOT NULL DEFAULT 0,
  pipeline_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT forecast_snapshots_period_check CHECK (period_end >= period_start)
);

-- Índices para performance
CREATE INDEX idx_forecast_snapshots_org_period ON public.forecast_snapshots(organization_id, period_start, period_end);
CREATE INDEX idx_forecast_snapshots_snapshot_date ON public.forecast_snapshots(snapshot_date DESC);

-- RLS
ALTER TABLE public.forecast_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org forecast snapshots"
ON public.forecast_snapshots FOR SELECT
USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can insert own org forecast snapshots"
ON public.forecast_snapshots FOR INSERT
WITH CHECK (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can update own org forecast snapshots"
ON public.forecast_snapshots FOR UPDATE
USING (organization_id = (SELECT get_user_organization_id()));

-- Comentários
COMMENT ON TABLE public.forecast_snapshots IS 'Histórico de previsões de forecast para calcular acurácia ao longo do tempo';
COMMENT ON COLUMN public.forecast_snapshots.closest_scenario IS 'Qual cenário foi mais próximo do realizado: pessimistic, realistic, optimistic, best_case';