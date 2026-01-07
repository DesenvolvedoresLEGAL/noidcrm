-- Corrigir função audit_organization_changes para não fazer cast ::text
-- O entity_id é do tipo UUID, não TEXT
CREATE OR REPLACE FUNCTION public.audit_organization_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    'organization',
    COALESCE(NEW.id, OLD.id),  -- UUID direto, sem cast para text
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit_organization_changes failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;