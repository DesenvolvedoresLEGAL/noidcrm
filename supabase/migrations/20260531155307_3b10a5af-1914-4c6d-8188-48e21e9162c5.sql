
-- 1. Tighten RLS: non-admins must NEVER see drafts/discarded via direct table reads
DROP POLICY IF EXISTS "Anyone can view release notes" ON public.release_notes;

CREATE POLICY "Anyone can view published release notes"
  ON public.release_notes FOR SELECT
  USING (status = 'published');

CREATE POLICY "Platform admins can view all release notes"
  ON public.release_notes FOR SELECT TO authenticated
  USING (public.is_platform_admin_for_rls(auth.uid()));

-- 2. Lock ingestion log: revoke anon (payloads may contain internal data)
REVOKE SELECT ON public.release_notes_ingestion_log FROM anon;

-- 3. Recreate public view with security_invoker so it applies caller's RLS
DROP VIEW IF EXISTS public.v_release_notes_public;
CREATE VIEW public.v_release_notes_public
  WITH (security_invoker = true) AS
SELECT id, version, title, description, release_date, changes, is_major,
       organization_id, created_at, published_at
FROM public.release_notes
WHERE status = 'published';

GRANT SELECT ON public.v_release_notes_public TO anon, authenticated;

-- 4. Audit trigger: logs publish / discard / edit events into system_events
CREATE OR REPLACE FUNCTION public.tg_release_notes_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'draft' THEN
      v_event := 'release_note_draft_generated';
    ELSIF NEW.status = 'published' THEN
      v_event := 'release_note_published';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status AND NEW.status = 'published' THEN
      v_event := 'release_note_published';
    ELSIF OLD.status <> NEW.status AND NEW.status = 'discarded' THEN
      v_event := 'release_note_discarded';
    ELSIF OLD.status = 'draft' AND NEW.status = 'draft'
          AND (OLD.title IS DISTINCT FROM NEW.title
               OR OLD.description IS DISTINCT FROM NEW.description
               OR OLD.changes IS DISTINCT FROM NEW.changes
               OR OLD.is_major IS DISTINCT FROM NEW.is_major) THEN
      v_event := 'release_note_edited';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.system_events (
    trace_id, actor_type, actor_id, event_type, event_category, action,
    entity_type, entity_id, payload
  ) VALUES (
    gen_random_uuid(),
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    v_actor,
    v_event,
    'system',
    v_event,
    'release_note',
    NEW.id,
    jsonb_build_object(
      'version', NEW.version,
      'status', NEW.status,
      'is_major', NEW.is_major,
      'generated_by', NEW.generated_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_notes_audit ON public.release_notes;
CREATE TRIGGER trg_release_notes_audit
  AFTER INSERT OR UPDATE ON public.release_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_release_notes_audit();
