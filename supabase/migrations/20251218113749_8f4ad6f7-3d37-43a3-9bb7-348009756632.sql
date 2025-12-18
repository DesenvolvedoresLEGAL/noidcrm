-- SPRINT 4: Migrate historical win/loss data from rejected proposals
-- Create win_loss_records for proposals that don't have them yet

-- First, insert win_loss_records for rejected proposals without existing records
INSERT INTO win_loss_records (
  organization_id,
  opportunity_id,
  outcome,
  reason_seller,
  reason_id,
  recorded_by_customer,
  created_at
)
SELECT DISTINCT ON (p.opportunity_id)
  p.organization_id,
  p.opportunity_id,
  'lost'::text as outcome,
  COALESCE(p.declined_reason, 'Proposta recusada - motivo não informado') as reason_seller,
  -- Try to match with existing loss_reasons by similarity
  (
    SELECT lr.id 
    FROM loss_reasons lr 
    WHERE lr.organization_id = p.organization_id 
      AND lr.is_active = true
      AND (
        similarity(lower(lr.name), lower(COALESCE(p.declined_reason, ''))) > 0.3
        OR lower(lr.name) LIKE '%' || lower(COALESCE(p.declined_reason, '')) || '%'
        OR lower(COALESCE(p.declined_reason, '')) LIKE '%' || lower(lr.name) || '%'
      )
    ORDER BY similarity(lower(lr.name), lower(COALESCE(p.declined_reason, ''))) DESC
    LIMIT 1
  ) as reason_id,
  false as recorded_by_customer,
  p.updated_at as created_at
FROM proposals p
WHERE p.status = 'rejected'
  AND p.opportunity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM win_loss_records wlr 
    WHERE wlr.opportunity_id = p.opportunity_id
  );

-- Update opportunities to 'lost' status if they have rejected proposals and are still open
UPDATE opportunities o
SET status = 'lost',
    updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM proposals p 
  WHERE p.opportunity_id = o.id 
    AND p.status = 'rejected'
)
AND o.status = 'open';

-- SPRINT 6: Add category column to loss_reasons
ALTER TABLE loss_reasons ADD COLUMN IF NOT EXISTS category TEXT;

-- Create index for category queries
CREATE INDEX IF NOT EXISTS idx_loss_reasons_category ON loss_reasons(category);

-- Migrate existing loss_reasons to categories based on name patterns
UPDATE loss_reasons SET category = 'price' 
WHERE category IS NULL AND (
  lower(name) LIKE '%preço%' OR 
  lower(name) LIKE '%preco%' OR 
  lower(name) LIKE '%custo%' OR 
  lower(name) LIKE '%valor%' OR
  lower(name) LIKE '%caro%' OR
  lower(name) LIKE '%barato%' OR
  lower(name) LIKE '%orçamento%' OR
  lower(name) LIKE '%orcamento%' OR
  lower(name) LIKE '%budget%'
);

UPDATE loss_reasons SET category = 'competition' 
WHERE category IS NULL AND (
  lower(name) LIKE '%concorr%' OR 
  lower(name) LIKE '%competidor%' OR 
  lower(name) LIKE '%alternativa%' OR
  lower(name) LIKE '%outro fornecedor%' OR
  lower(name) LIKE '%outra empresa%'
);

UPDATE loss_reasons SET category = 'timing' 
WHERE category IS NULL AND (
  lower(name) LIKE '%timing%' OR 
  lower(name) LIKE '%momento%' OR 
  lower(name) LIKE '%prazo%' OR
  lower(name) LIKE '%urgência%' OR
  lower(name) LIKE '%urgencia%' OR
  lower(name) LIKE '%tempo%' OR
  lower(name) LIKE '%agora%' OR
  lower(name) LIKE '%depois%' OR
  lower(name) LIKE '%adiado%' OR
  lower(name) LIKE '%postergado%'
);

UPDATE loss_reasons SET category = 'product' 
WHERE category IS NULL AND (
  lower(name) LIKE '%produto%' OR 
  lower(name) LIKE '%funcionalidade%' OR 
  lower(name) LIKE '%feature%' OR
  lower(name) LIKE '%solução%' OR
  lower(name) LIKE '%solucao%' OR
  lower(name) LIKE '%fit%' OR
  lower(name) LIKE '%necessidade%' OR
  lower(name) LIKE '%escopo%'
);

UPDATE loss_reasons SET category = 'relationship' 
WHERE category IS NULL AND (
  lower(name) LIKE '%relacionamento%' OR 
  lower(name) LIKE '%atendimento%' OR 
  lower(name) LIKE '%comunicação%' OR
  lower(name) LIKE '%comunicacao%' OR
  lower(name) LIKE '%suporte%' OR
  lower(name) LIKE '%confiança%' OR
  lower(name) LIKE '%confianca%'
);

UPDATE loss_reasons SET category = 'internal' 
WHERE category IS NULL AND (
  lower(name) LIKE '%interno%' OR 
  lower(name) LIKE '%política%' OR 
  lower(name) LIKE '%politica%' OR
  lower(name) LIKE '%aprovação%' OR
  lower(name) LIKE '%aprovacao%' OR
  lower(name) LIKE '%budget%' OR
  lower(name) LIKE '%congelado%' OR
  lower(name) LIKE '%projeto%'
);

-- Set remaining uncategorized to 'other'
UPDATE loss_reasons SET category = 'other' 
WHERE category IS NULL;