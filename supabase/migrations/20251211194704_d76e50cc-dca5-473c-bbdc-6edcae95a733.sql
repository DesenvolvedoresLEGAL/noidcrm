-- Adiciona coluna opcional para unidade de medida nos itens da proposta
ALTER TABLE proposal_items 
ADD COLUMN measurement_unit_id uuid REFERENCES measurement_units(id);

-- Index para performance em joins
CREATE INDEX idx_proposal_items_measurement_unit 
ON proposal_items(measurement_unit_id);