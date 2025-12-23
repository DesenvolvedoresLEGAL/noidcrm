-- Add flag threshold columns to sales_config table
ALTER TABLE sales_config 
ADD COLUMN IF NOT EXISTS flag_blue_threshold NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS flag_yellow_min_threshold NUMERIC DEFAULT 70,
ADD COLUMN IF NOT EXISTS flag_yellow_max_threshold NUMERIC DEFAULT 99.99;

-- Add comments for documentation
COMMENT ON COLUMN sales_config.flag_blue_threshold IS 'Achievement percentage threshold for Blue Flag (meta atingida)';
COMMENT ON COLUMN sales_config.flag_yellow_min_threshold IS 'Minimum achievement percentage for Yellow Flag';
COMMENT ON COLUMN sales_config.flag_yellow_max_threshold IS 'Maximum achievement percentage for Yellow Flag';