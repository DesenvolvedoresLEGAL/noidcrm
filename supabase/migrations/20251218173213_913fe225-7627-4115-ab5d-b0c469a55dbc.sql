-- Drop existing function if exists (will be replaced by trigger)
-- The old function will remain for backwards compatibility but won't be called from frontend

-- Create trigger function to generate proposal number on insert
CREATE OR REPLACE FUNCTION set_proposal_number_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INT;
  v_number TEXT;
BEGIN
  -- Only generate if proposal_number is NULL
  IF NEW.proposal_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get organization prefix or use default
  SELECT COALESCE(proposal_prefix, 'PROP')
  INTO v_prefix
  FROM organizations
  WHERE id = NEW.organization_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'PROP';
  END IF;
  
  -- Get current year
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Increment sequence atomically
  UPDATE organizations
  SET proposal_sequence = COALESCE(proposal_sequence, 0) + 1
  WHERE id = NEW.organization_id
  RETURNING proposal_sequence INTO v_sequence;
  
  -- Format: PREFIX-YYYY-NNNNN (5 digits)
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  NEW.proposal_number := v_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_set_proposal_number ON proposals;

-- Create trigger BEFORE INSERT to set proposal number
CREATE TRIGGER trigger_set_proposal_number
  BEFORE INSERT ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION set_proposal_number_on_insert();

-- Add comment for documentation
COMMENT ON FUNCTION set_proposal_number_on_insert() IS 'Generates sequential proposal number on insert. Number is only generated if not provided, ensuring no lost numbers on failed inserts.';