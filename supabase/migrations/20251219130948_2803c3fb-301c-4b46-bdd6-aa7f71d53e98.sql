-- Adicionar campos de metas por período na tabela sales_config
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS quarterly_goal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS semester_goal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS yearly_goal NUMERIC DEFAULT 0;

COMMENT ON COLUMN sales_config.quarterly_goal IS 'Meta de receita trimestral';
COMMENT ON COLUMN sales_config.semester_goal IS 'Meta de receita semestral';
COMMENT ON COLUMN sales_config.yearly_goal IS 'Meta de receita anual';