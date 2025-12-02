-- =============================================
-- TABELA RELEASE NOTES
-- =============================================
CREATE TABLE public.release_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_major BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para release_notes (público para leitura)
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view release notes"
ON public.release_notes FOR SELECT
USING (true);

CREATE POLICY "System manages release notes"
ON public.release_notes FOR INSERT
WITH CHECK (true);

-- =============================================
-- FUNÇÃO AUXILIAR PARA CRIAR NOTIFICAÇÕES
-- =============================================
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id UUID,
  p_org_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, metadata)
  VALUES (p_user_id, p_org_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- =============================================
-- TRIGGER PARA OPORTUNIDADES
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_opportunity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_system_notification(
      NEW.owner_user_id,
      NEW.organization_id,
      'opportunity_created',
      'Nova oportunidade criada',
      'Oportunidade "' || NEW.title || '" foi criada com sucesso.',
      jsonb_build_object('opportunity_id', NEW.id, 'title', NEW.title)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM create_system_notification(
        NEW.owner_user_id,
        NEW.organization_id,
        'opportunity_status',
        CASE 
          WHEN NEW.status = 'won' THEN 'Oportunidade ganha!'
          WHEN NEW.status = 'lost' THEN 'Oportunidade perdida'
          ELSE 'Status atualizado'
        END,
        'Oportunidade "' || NEW.title || '" teve status alterado para ' || NEW.status,
        jsonb_build_object('opportunity_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      PERFORM create_system_notification(
        NEW.owner_user_id,
        NEW.organization_id,
        'opportunity_stage',
        'Oportunidade movida no funil',
        'Oportunidade "' || NEW.title || '" avançou de estágio.',
        jsonb_build_object('opportunity_id', NEW.id, 'old_stage', OLD.stage_id, 'new_stage', NEW.stage_id)
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_opportunity_changes ON public.opportunities;
CREATE TRIGGER trigger_notify_opportunity_changes
AFTER INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION notify_opportunity_changes();

-- =============================================
-- TRIGGER PARA CONTAS
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_account_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.owner_user_id, (SELECT user_id FROM organization_members WHERE organization_id = NEW.organization_id AND status = 'active' LIMIT 1));
  
  IF TG_OP = 'INSERT' THEN
    PERFORM create_system_notification(
      v_user_id,
      NEW.organization_id,
      'account_created',
      'Nova conta cadastrada',
      'Conta "' || COALESCE(NEW.nome_fantasia, NEW.razao_social) || '" foi cadastrada.',
      jsonb_build_object('account_id', NEW.id, 'name', COALESCE(NEW.nome_fantasia, NEW.razao_social))
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_account_changes ON public.accounts;
CREATE TRIGGER trigger_notify_account_changes
AFTER INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION notify_account_changes();

-- =============================================
-- TRIGGER PARA PROPOSTAS
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_proposal_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := (SELECT owner_user_id FROM opportunities WHERE id = NEW.opportunity_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM create_system_notification(
      v_user_id,
      NEW.organization_id,
      'proposal_created',
      'Nova proposta criada',
      'Proposta "' || NEW.title || '" foi criada.',
      jsonb_build_object('proposal_id', NEW.id, 'title', NEW.title)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM create_system_notification(
        v_user_id,
        NEW.organization_id,
        'proposal_status',
        CASE 
          WHEN NEW.status = 'accepted' THEN 'Proposta aceita!'
          WHEN NEW.status = 'rejected' THEN 'Proposta rejeitada'
          WHEN NEW.status = 'sent' THEN 'Proposta enviada'
          ELSE 'Proposta atualizada'
        END,
        'Proposta "' || NEW.title || '" teve status alterado para ' || NEW.status,
        jsonb_build_object('proposal_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_proposal_changes ON public.proposals;
CREATE TRIGGER trigger_notify_proposal_changes
AFTER INSERT OR UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION notify_proposal_changes();

-- =============================================
-- TRIGGER PARA ATIVIDADES
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_activity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_system_notification(
      NEW.owner_user_id,
      NEW.organization_id,
      'activity_created',
      'Nova atividade agendada',
      'Atividade "' || NEW.title || '" foi criada.',
      jsonb_build_object('activity_id', NEW.id, 'title', NEW.title, 'type', NEW.type)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      PERFORM create_system_notification(
        NEW.owner_user_id,
        NEW.organization_id,
        'activity_completed',
        'Atividade concluída',
        'Atividade "' || NEW.title || '" foi marcada como concluída.',
        jsonb_build_object('activity_id', NEW.id, 'title', NEW.title)
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_activity_changes ON public.activities;
CREATE TRIGGER trigger_notify_activity_changes
AFTER INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION notify_activity_changes();