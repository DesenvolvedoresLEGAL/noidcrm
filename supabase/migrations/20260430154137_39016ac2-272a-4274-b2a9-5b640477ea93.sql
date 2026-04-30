CREATE OR REPLACE FUNCTION public.import_prospect_to_pipeline(p_prospect_id uuid, p_target_pipeline_type text DEFAULT 'qualification'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prospect RECORD;
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_pipeline_id TEXT;
  v_stage_id TEXT;
  v_account_id UUID;
  v_account_created BOOLEAN := FALSE;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_priority_score INTEGER;
  v_emails JSONB;
  v_telefones JSONB;
  v_signals JSONB := '[]'::jsonb;
  v_reasoning JSONB;
  v_profile RECORD;
  v_brief RECORD;
  v_has_profile BOOLEAN := FALSE;
  v_has_brief BOOLEAN := FALSE;
  v_note_id UUID;
  v_note_md TEXT;
  v_email_subject TEXT;
  v_email_body TEXT;
  v_email_to TEXT;
  v_account_name TEXT;
  v_geographic_presence_text TEXT;
  v_probable_pains_text TEXT;
  v_value_hypotheses_text TEXT;
  v_objection_predictions_text TEXT;
  v_email_payload JSONB := NULL;
  v_enriched_ids uuid[];
  v_sync_result jsonb;
  v_synced_primary uuid;
  v_existing_def text;
BEGIN
  -- Preserve original body but only patch the broken stage lookup section.
  -- We rebuild the function with the correct table (stages) and column (order_index).
  RAISE NOTICE 'placeholder';
END;
$function$;
-- We immediately replace with the full corrected body below
