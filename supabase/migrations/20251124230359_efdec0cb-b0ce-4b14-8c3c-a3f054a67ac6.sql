-- Criar tabela de histórico de preços
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  old_cost NUMERIC(12,2),
  new_cost NUMERIC(12,2),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

-- Índices para melhor performance
CREATE INDEX idx_price_history_product ON product_price_history(product_id);
CREATE INDEX idx_price_history_org ON product_price_history(organization_id);
CREATE INDEX idx_price_history_date ON product_price_history(changed_at DESC);

-- RLS Policies
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org price history"
ON product_price_history FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert price history"
ON product_price_history FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- Trigger para rastrear mudanças de preço
CREATE OR REPLACE FUNCTION track_product_price_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra se preço ou custo mudaram
  IF (OLD.price IS DISTINCT FROM NEW.price) OR (OLD.cost IS DISTINCT FROM NEW.cost) THEN
    INSERT INTO product_price_history (
      product_id,
      organization_id,
      old_price,
      new_price,
      old_cost,
      new_cost,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.organization_id,
      OLD.price,
      NEW.price,
      OLD.cost,
      NEW.cost,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_price_change_trigger
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION track_product_price_changes();