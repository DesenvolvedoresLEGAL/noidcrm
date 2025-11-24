-- Sprint 4: Templates e Agendamento de Exportações
-- Tabelas para templates de exportação e exportações agendadas

-- Tabela de templates de exportação
CREATE TABLE IF NOT EXISTS export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('accounts', 'contacts', 'opportunities', 'products', 'activities')),
  format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'excel', 'pdf')),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de exportações agendadas
CREATE TABLE IF NOT EXISTS scheduled_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES export_templates(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cron_expression TEXT NOT NULL,
  email_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de exportações
CREATE TABLE IF NOT EXISTS export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduled_export_id UUID REFERENCES scheduled_exports(id) ON DELETE SET NULL,
  template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
  executed_by UUID,
  entity_type TEXT NOT NULL,
  format TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  file_size INTEGER,
  file_path TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_export_templates_org ON export_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_org ON scheduled_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run ON scheduled_exports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_export_logs_org ON export_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_created ON export_logs(created_at DESC);

-- Triggers para updated_at
CREATE TRIGGER update_export_templates_updated_at
  BEFORE UPDATE ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_exports_updated_at
  BEFORE UPDATE ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

-- Export Templates Policies
CREATE POLICY "Users can view org export templates"
  ON export_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org export templates"
  ON export_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org export templates"
  ON export_templates FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete export templates"
  ON export_templates FOR DELETE
  USING (user_is_org_admin(organization_id));

-- Scheduled Exports Policies
CREATE POLICY "Users can view org scheduled exports"
  ON scheduled_exports FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org scheduled exports"
  ON scheduled_exports FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org scheduled exports"
  ON scheduled_exports FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete scheduled exports"
  ON scheduled_exports FOR DELETE
  USING (user_is_org_admin(organization_id));

-- Export Logs Policies
CREATE POLICY "Users can view org export logs"
  ON export_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert export logs"
  ON export_logs FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE export_templates IS 'Templates customizados para exportação de dados';
COMMENT ON TABLE scheduled_exports IS 'Exportações agendadas com cron expressions';
COMMENT ON TABLE export_logs IS 'Histórico de execuções de exportações';