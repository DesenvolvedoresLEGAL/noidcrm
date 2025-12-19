-- Create table for conversion rate benchmarks
CREATE TABLE public.conversion_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'outbound', 'inbound', 'indicacao', 'overall'
  metric TEXT NOT NULL, -- 'win_rate', 'lead_to_mql', 'mql_to_proposal', 'proposal_to_sale'
  min_threshold DECIMAL(5,2) NOT NULL DEFAULT 0, -- percentage below which to alert
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, channel, metric)
);

-- Create table for conversion rate alerts
CREATE TABLE public.conversion_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  benchmark_id UUID REFERENCES public.conversion_benchmarks(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  metric TEXT NOT NULL,
  current_value DECIMAL(5,2) NOT NULL,
  threshold_value DECIMAL(5,2) NOT NULL,
  previous_value DECIMAL(5,2), -- for trend comparison
  trend_direction TEXT, -- 'up', 'down', 'stable'
  trend_percentage DECIMAL(5,2),
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversion_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for benchmarks (admins can manage, all can read)
CREATE POLICY "Users can view org benchmarks"
ON public.conversion_benchmarks FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage benchmarks"
ON public.conversion_benchmarks FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND org_role IN ('admin', 'owner')
  )
);

-- RLS Policies for alerts
CREATE POLICY "Users can view org alerts"
ON public.conversion_alerts FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage alerts"
ON public.conversion_alerts FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND org_role IN ('admin', 'owner', 'manager')
  )
);

-- Create indexes
CREATE INDEX idx_conversion_benchmarks_org ON public.conversion_benchmarks(organization_id);
CREATE INDEX idx_conversion_alerts_org_status ON public.conversion_alerts(organization_id, status);
CREATE INDEX idx_conversion_alerts_created ON public.conversion_alerts(created_at DESC);

-- Insert default benchmarks for organizations that have sales_config
INSERT INTO public.conversion_benchmarks (organization_id, channel, metric, min_threshold)
SELECT DISTINCT sc.organization_id, channel.channel, metric.metric, 
  CASE 
    WHEN metric.metric = 'win_rate' THEN 25
    WHEN metric.metric = 'proposal_to_sale' THEN 40
    WHEN metric.metric = 'mql_to_proposal' THEN 70
    WHEN metric.metric = 'lead_to_mql' THEN 60
    ELSE 50
  END
FROM public.sales_config sc
CROSS JOIN (VALUES ('overall'), ('outbound'), ('inbound'), ('indicacao')) AS channel(channel)
CROSS JOIN (VALUES ('win_rate'), ('proposal_to_sale')) AS metric(metric)
ON CONFLICT DO NOTHING;