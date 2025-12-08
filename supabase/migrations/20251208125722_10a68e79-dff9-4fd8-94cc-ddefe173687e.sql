-- Corrigir RLS INSERT policies para activities, accounts, contacts, proposals, contracts
-- Usar mesmo padrão robusto com verificação explícita de auth.uid()

-- ACTIVITIES
DROP POLICY IF EXISTS "Users can insert in own org activities" ON activities;
CREATE POLICY "Users can insert in own org activities"
ON activities
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = activities.organization_id
      AND organization_members.status = 'active'
  )
);

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can insert org accounts" ON accounts;
CREATE POLICY "Users can insert org accounts"
ON accounts
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = accounts.organization_id
      AND organization_members.status = 'active'
  )
);

-- CONTACTS
DROP POLICY IF EXISTS "Users can insert org contacts" ON contacts;
CREATE POLICY "Users can insert org contacts"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = contacts.organization_id
      AND organization_members.status = 'active'
  )
);

-- PROPOSALS (has duplicate policies, clean up)
DROP POLICY IF EXISTS "Users can create proposals" ON proposals;
DROP POLICY IF EXISTS "Users can insert org proposals" ON proposals;
CREATE POLICY "Users can insert org proposals"
ON proposals
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = proposals.organization_id
      AND organization_members.status = 'active'
  )
);

-- CONTRACTS (has duplicate policies, clean up)
DROP POLICY IF EXISTS "Users can insert contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert org contracts" ON contracts;
CREATE POLICY "Users can insert org contracts"
ON contracts
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = contracts.organization_id
      AND organization_members.status = 'active'
  )
);