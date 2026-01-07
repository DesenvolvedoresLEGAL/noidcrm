-- =============================================
-- AUTH AUDIT LOG: Sistema de Auditoria de Autenticação
-- =============================================

-- Tabela para armazenar logs de autenticação enriquecidos
CREATE TABLE public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'signup', 'failed_login', 'password_reset')),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Dados de IP e Localização
  ip_address INET,
  country_code TEXT,
  country_name TEXT,
  city TEXT,
  region TEXT,
  isp TEXT,
  is_vpn BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  
  -- Dados do Dispositivo
  user_agent TEXT,
  device_type TEXT CHECK (device_type IS NULL OR device_type IN ('mobile', 'tablet', 'desktop')),
  browser_hash TEXT,
  canvas_hash TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  language TEXT,
  
  -- Contexto
  referrer TEXT,
  page_url TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para consultas eficientes
CREATE INDEX idx_auth_audit_user ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_email ON auth_audit_log(email);
CREATE INDEX idx_auth_audit_ip ON auth_audit_log(ip_address);
CREATE INDEX idx_auth_audit_created ON auth_audit_log(created_at DESC);
CREATE INDEX idx_auth_audit_event ON auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_country ON auth_audit_log(country_code);

-- RLS
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas platform admins podem ler os logs de auditoria
CREATE POLICY "Platform admins can read auth audit" ON auth_audit_log
  FOR SELECT TO authenticated
  USING (public.is_platform_admin_for_rls(auth.uid()));