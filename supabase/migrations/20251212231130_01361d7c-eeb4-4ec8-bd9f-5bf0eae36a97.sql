-- Função que cria oportunidade automaticamente quando conta é criada
CREATE OR REPLACE FUNCTION public.auto_create_opportunity_from_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id TEXT;
  v_stage_id TEXT;
  v_owner_user_id UUID;
BEGIN
  -- Buscar pipeline PRÉ VENDAS (qualification) da organização
  SELECT id INTO v_pipeline_id
  FROM pipelines
  WHERE organization_id = NEW.organization_id
    AND (pipeline_type = 'qualification' OR name ILIKE '%pré vendas%' OR name ILIKE '%pre vendas%')
  LIMIT 1;
  
  -- Se não encontrar, não criar oportunidade
  IF v_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar primeiro estágio do pipeline (Novos Leads)
  SELECT id INTO v_stage_id
  FROM stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY order_index ASC
  LIMIT 1;
  
  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Owner: usar owner da conta ou primeiro owner/admin ativo da org
  v_owner_user_id := COALESCE(
    NEW.owner_user_id,
    (SELECT user_id FROM organization_members 
     WHERE organization_id = NEW.organization_id 
       AND status = 'active' 
       AND org_role IN ('owner', 'admin')
     ORDER BY joined_at ASC LIMIT 1)
  );
  
  -- Criar oportunidade automaticamente
  INSERT INTO opportunities (
    organization_id,
    account_id,
    pipeline_id,
    stage_id,
    owner_user_id,
    title,
    status,
    temperature
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    v_pipeline_id,
    v_stage_id,
    v_owner_user_id,
    'Lead: ' || COALESCE(NEW.nome_fantasia, NEW.razao_social),
    'open',
    'warm'
  );
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_auto_create_opportunity ON accounts;
CREATE TRIGGER trigger_auto_create_opportunity
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_opportunity_from_account();