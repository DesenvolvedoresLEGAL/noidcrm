-- Update proposal_items with correct billing_type from products
UPDATE proposal_items pi
SET billing_type = p.billing_type
FROM products p
WHERE pi.product_id = p.id
AND pi.product_id IS NOT NULL
AND (pi.billing_type IS NULL OR pi.billing_type IS DISTINCT FROM p.billing_type);

-- Set default billing_type for items without products
UPDATE proposal_items
SET billing_type = 'one_time'
WHERE billing_type IS NULL;