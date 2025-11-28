-- Sprint 5: Digital Signature & Formal Acceptance

-- Add acceptance tracking fields to proposals table
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS acceptor_name TEXT,
ADD COLUMN IF NOT EXISTS acceptor_document TEXT,
ADD COLUMN IF NOT EXISTS acceptor_position TEXT,
ADD COLUMN IF NOT EXISTS acceptor_ip TEXT,
ADD COLUMN IF NOT EXISTS acceptor_user_agent TEXT,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS acceptance_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS acceptance_proof_url TEXT;

-- Create index for acceptance hash lookups
CREATE INDEX IF NOT EXISTS idx_proposals_acceptance_hash ON proposals(acceptance_hash);

-- Create function to generate acceptance hash
CREATE OR REPLACE FUNCTION generate_acceptance_hash(p_proposal_id UUID, p_acceptor_document TEXT, p_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$
BEGIN
  -- Generate SHA-256 hash from proposal ID, document, and timestamp
  RETURN encode(
    digest(
      p_proposal_id::text || p_acceptor_document || p_timestamp::text,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create contract when proposal is accepted
CREATE OR REPLACE FUNCTION create_contract_from_proposal()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_account_id UUID;
  v_contact_id UUID;
  v_owner_user_id UUID;
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    
    -- Get opportunity details
    SELECT account_id, contact_id, owner_user_id
    INTO v_account_id, v_contact_id, v_owner_user_id
    FROM opportunities
    WHERE id = NEW.opportunity_id;
    
    -- Create contract if we have required data
    IF v_account_id IS NOT NULL AND v_owner_user_id IS NOT NULL THEN
      INSERT INTO contracts (
        organization_id,
        opportunity_id,
        account_id,
        contact_id,
        owner_user_id,
        title,
        contract_value,
        status,
        start_date,
        end_date,
        payment_terms,
        terms_and_conditions
      ) VALUES (
        NEW.organization_id,
        NEW.opportunity_id,
        v_account_id,
        v_contact_id,
        v_owner_user_id,
        'Contrato - ' || NEW.title,
        NEW.value,
        'active',
        CURRENT_DATE,
        NEW.expires_at,
        (SELECT string_agg(description || ': ' || amount::text, E'\n') FROM proposal_payment_terms WHERE proposal_id = NEW.id),
        NEW.terms
      ) RETURNING id INTO v_contract_id;
      
      -- Update opportunity status to 'won' and link contract
      UPDATE opportunities
      SET status = 'won'
      WHERE id = NEW.opportunity_id;
      
      -- Log the contract creation
      INSERT INTO audit_log (
        organization_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        NEW.organization_id,
        'contract_created_from_proposal',
        'contract',
        v_contract_id,
        jsonb_build_object(
          'proposal_id', NEW.id,
          'opportunity_id', NEW.opportunity_id,
          'acceptor_name', NEW.acceptor_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_contract_from_proposal ON proposals;
CREATE TRIGGER trigger_create_contract_from_proposal
  AFTER UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION create_contract_from_proposal();

-- Add comment
COMMENT ON TRIGGER trigger_create_contract_from_proposal ON proposals IS 
  'Automatically creates a contract and marks opportunity as won when proposal is accepted';