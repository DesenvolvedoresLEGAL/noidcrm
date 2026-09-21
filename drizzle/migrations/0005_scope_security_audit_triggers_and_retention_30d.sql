SET LOCAL lock_timeout = '15s';

-- Auditoria de segurança deixa de registrar updates automáticos de score/IA
DROP TRIGGER IF EXISTS audit_opportunities_changes ON public.opportunities;
CREATE TRIGGER audit_opportunities_changes
AFTER DELETE OR UPDATE OF
  title, stage_id, status, valor_previsto, mrr_value, close_date_prevista,
  owner_user_id, account_id, contact_id, pipeline_id, loss_reason_id,
  closed_at, deleted_at
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_operation();

DROP TRIGGER IF EXISTS audit_accounts_changes ON public.accounts;
CREATE TRIGGER audit_accounts_changes
AFTER DELETE OR UPDATE OF
  razao_social, nome_fantasia, cnpj, segmento, porte, cidade, uf,
  telefones, emails, owner_user_id, deleted_at
ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_operation();

-- Retenção mais curta para ruído (info/warning/low): 30 dias
CREATE OR REPLACE FUNCTION public.prune_log_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec integer := 0;
  v_nrhs integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.security_audit_log
    WHERE ctid IN (
      SELECT ctid FROM public.security_audit_log
      WHERE (
        (COALESCE(severity,'info') IN ('low','info','debug','warning') AND created_at < now() - interval '30 days')
        OR created_at < now() - interval '365 days'
      )
      LIMIT 50000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_sec FROM del;

  WITH del2 AS (
    DELETE FROM public.nrhs_learning_signals
    WHERE ctid IN (
      SELECT ctid FROM public.nrhs_learning_signals
      WHERE created_at < now() - interval '180 days'
      LIMIT 50000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_nrhs FROM del2;

  RETURN jsonb_build_object('security_audit_log', v_sec, 'nrhs_learning_signals', v_nrhs);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_log_tables() FROM PUBLIC, anon, authenticated;