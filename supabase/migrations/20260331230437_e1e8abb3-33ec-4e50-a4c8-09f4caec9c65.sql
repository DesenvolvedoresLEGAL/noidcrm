
-- Normalize legacy category values in loss_reasons to standardized keys
UPDATE public.loss_reasons SET category = 'no_fit' WHERE category = 'product';
UPDATE public.loss_reasons SET category = 'sales_process' WHERE category = 'relationship';
UPDATE public.loss_reasons SET category = 'sales_process' WHERE category = 'service';
UPDATE public.loss_reasons SET category = 'price' WHERE category = 'brand';
