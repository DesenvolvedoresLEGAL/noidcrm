-- HOTFIX F2.8.1: garantir que o enum app_role reconheça os valores
-- 'owner' e 'platform_admin', usados por RPCs do Forecast V2
-- (calculate_forecast_audit_v2, get_forecast_intelligence_v2,
-- get_forecast_risk_center_v2, get_forecast_v2_health_check, etc.)
-- via has_role(uid, 'owner'::app_role) / 'platform_admin'::app_role.
--
-- Sem este fix, chamadas como has_role(auth.uid(), 'owner'::app_role)
-- quebram com: invalid input value for enum app_role: "owner".
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE IF NOT EXISTS é seguro,
-- não recria o enum, não altera dados, e não consome o novo valor
-- na mesma transação.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';