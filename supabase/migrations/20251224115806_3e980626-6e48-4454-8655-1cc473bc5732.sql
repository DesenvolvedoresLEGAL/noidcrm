-- Tabela de alertas de vibe
CREATE TABLE IF NOT EXISTS public.vibe_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Tipo e conteúdo do alerta
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'energy_drop',      -- Lead esfriou
    'silence_warning',  -- Silêncio prolongado
    'hot_timing',       -- Momento favorável para fechar
    'vibe_break_risk',  -- Risco de quebra de vibe
    'ready_to_close',   -- Lead pronto para fechar
    'needs_nurturing',  -- Precisa ser nutrido
    'objection_pattern',-- Padrão de objeção detectado
    'engagement_spike'  -- Pico de engajamento
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recommendation TEXT,
  
  -- Metadados
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  trigger_data JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed', 'acted')),
  acknowledged_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  
  -- Timestamps
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vibe_alerts_org ON public.vibe_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_vibe_alerts_opp ON public.vibe_alerts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_vibe_alerts_user ON public.vibe_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_alerts_status ON public.vibe_alerts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_vibe_alerts_type ON public.vibe_alerts(alert_type);

-- RLS
ALTER TABLE public.vibe_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vibe alerts for their org"
ON public.vibe_alerts FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert vibe alerts for their org"
ON public.vibe_alerts FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update vibe alerts for their org"
ON public.vibe_alerts FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete vibe alerts for their org"
ON public.vibe_alerts FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

-- Comentários
COMMENT ON TABLE public.vibe_alerts IS 'Alertas de vibe para Vibe Selling - notificações contextuais sobre estado do lead';
COMMENT ON COLUMN public.vibe_alerts.alert_type IS 'Tipo do alerta baseado em padrões de vibe';
COMMENT ON COLUMN public.vibe_alerts.trigger_data IS 'Dados que dispararam o alerta (scores, métricas, etc)';