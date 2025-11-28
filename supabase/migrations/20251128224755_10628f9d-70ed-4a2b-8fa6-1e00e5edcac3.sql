-- Sprint 4: Layouts Avançados & Controle

-- 1. Add proposal configuration columns to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'BRL' CHECK (default_currency IN ('BRL', 'USD', 'EUR')),
ADD COLUMN IF NOT EXISTS proposal_prefix TEXT DEFAULT 'PROP',
ADD COLUMN IF NOT EXISTS proposal_sequence INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS proposal_validity_days INTEGER DEFAULT 30;

-- 2. Add advanced fields to proposals table
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS proposal_number TEXT,
ADD COLUMN IF NOT EXISTS proposal_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD', 'EUR')),
ADD COLUMN IF NOT EXISTS parent_proposal_id UUID REFERENCES proposals(id);

-- 3. Add pipeline association to proposal_layouts
ALTER TABLE proposal_layouts
ADD COLUMN IF NOT EXISTS pipeline_ids TEXT[] DEFAULT NULL;

-- 4. Create index for proposal number lookups
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_number ON proposals(proposal_number);
CREATE INDEX IF NOT EXISTS idx_proposals_parent_proposal_id ON proposals(parent_proposal_id);

-- 5. Create function to generate next proposal number
CREATE OR REPLACE FUNCTION generate_proposal_number(p_org_id UUID, p_prefix TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INTEGER;
  v_proposal_number TEXT;
BEGIN
  -- Get prefix from parameter or organization settings
  IF p_prefix IS NOT NULL THEN
    v_prefix := p_prefix;
  ELSE
    SELECT COALESCE(proposal_prefix, 'PROP') INTO v_prefix
    FROM organizations
    WHERE id = p_org_id;
  END IF;
  
  -- Get current year
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Increment and get next sequence number
  UPDATE organizations
  SET proposal_sequence = proposal_sequence + 1
  WHERE id = p_org_id
  RETURNING proposal_sequence INTO v_sequence;
  
  -- Format: PREFIX-YEAR-00001
  v_proposal_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_proposal_number;
END;
$$;

-- 6. Create function to create new proposal version
CREATE OR REPLACE FUNCTION create_proposal_version(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_proposal_id UUID;
  v_max_version INTEGER;
  v_org_id UUID;
BEGIN
  -- Get organization and max version
  SELECT organization_id INTO v_org_id
  FROM proposals
  WHERE id = p_proposal_id;
  
  -- Find max version for this proposal family
  SELECT COALESCE(MAX(proposal_version), 0) + 1 INTO v_max_version
  FROM proposals
  WHERE (id = p_proposal_id OR parent_proposal_id = p_proposal_id)
    AND organization_id = v_org_id;
  
  -- Create new version by copying original proposal
  INSERT INTO proposals (
    organization_id,
    opportunity_id,
    layout_id,
    title,
    client_name,
    client_email,
    introduction,
    terms,
    notes,
    value,
    expires_at,
    proposal_number,
    proposal_version,
    currency,
    parent_proposal_id,
    status
  )
  SELECT
    organization_id,
    opportunity_id,
    layout_id,
    title || ' (v' || v_max_version || ')',
    client_name,
    client_email,
    introduction,
    terms,
    notes,
    value,
    expires_at,
    proposal_number,
    v_max_version,
    currency,
    p_proposal_id,
    'draft'
  FROM proposals
  WHERE id = p_proposal_id
  RETURNING id INTO v_new_proposal_id;
  
  RETURN v_new_proposal_id;
END;
$$;

-- 7. Add comment to explain currency codes
COMMENT ON COLUMN proposals.currency IS 'Currency code: BRL (Brazilian Real), USD (US Dollar), EUR (Euro)';
COMMENT ON COLUMN organizations.default_currency IS 'Default currency for new proposals: BRL, USD, EUR';