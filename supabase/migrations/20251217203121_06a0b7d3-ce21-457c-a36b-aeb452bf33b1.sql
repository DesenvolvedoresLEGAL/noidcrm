-- =========================================
-- ANTI-DUPLICATION SOLUTION - PHASE 1
-- Unique indexes + Data cleanup
-- =========================================

-- 1. Clean up duplicate contracts (keep oldest per opportunity)
DELETE FROM contracts c1
WHERE c1.opportunity_id IS NOT NULL
AND c1.id NOT IN (
  SELECT DISTINCT ON (organization_id, opportunity_id) id
  FROM contracts
  WHERE opportunity_id IS NOT NULL
  ORDER BY organization_id, opportunity_id, created_at ASC
);

-- 2. Clean up duplicate automated activities (keep oldest per opportunity+title)
DELETE FROM activities a1
WHERE a1.is_automated = true
AND a1.opportunity_id IS NOT NULL
AND a1.id NOT IN (
  SELECT DISTINCT ON (organization_id, opportunity_id, title) id
  FROM activities
  WHERE is_automated = true AND opportunity_id IS NOT NULL
  ORDER BY organization_id, opportunity_id, title, created_at ASC
);

-- 3. Create UNIQUE partial index on contracts (one contract per opportunity)
CREATE UNIQUE INDEX IF NOT EXISTS contracts_unique_per_opportunity 
ON contracts(organization_id, opportunity_id) 
WHERE opportunity_id IS NOT NULL;

-- 4. Create UNIQUE partial index on automated activities (one activity per title per opportunity)
CREATE UNIQUE INDEX IF NOT EXISTS activities_unique_automated_per_opportunity 
ON activities(organization_id, opportunity_id, title) 
WHERE is_automated = true AND opportunity_id IS NOT NULL;

-- 5. Create UNIQUE index on custom_field_values (one value per field per entity)
CREATE UNIQUE INDEX IF NOT EXISTS custom_field_values_unique_per_entity 
ON custom_field_values(entity_id, custom_field_id);

-- 6. Create UNIQUE index on win_loss_records (one record per opportunity)
CREATE UNIQUE INDEX IF NOT EXISTS win_loss_records_unique_per_opportunity 
ON win_loss_records(opportunity_id) 
WHERE opportunity_id IS NOT NULL;