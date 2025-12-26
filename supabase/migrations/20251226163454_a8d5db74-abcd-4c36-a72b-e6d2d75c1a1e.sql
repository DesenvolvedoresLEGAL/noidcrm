
-- Adicionar colunas de performance gates na tabela ote_monthly_results
ALTER TABLE public.ote_monthly_results 
ADD COLUMN IF NOT EXISTS performance_gate_multiplier NUMERIC(5,4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS acceleration_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gates_applied JSONB,
ADD COLUMN IF NOT EXISTS performance_scores JSONB;

-- Comentários para documentação
COMMENT ON COLUMN public.ote_monthly_results.performance_gate_multiplier IS 'Multiplicador aplicado pelos gates de performance (ex: 0.90 para BS < 60)';
COMMENT ON COLUMN public.ote_monthly_results.acceleration_blocked IS 'Se a aceleração foi bloqueada por algum gate';
COMMENT ON COLUMN public.ote_monthly_results.gates_applied IS 'Lista de gates que foram aplicados neste cálculo';
COMMENT ON COLUMN public.ote_monthly_results.performance_scores IS 'Snapshot dos scores CS, BS, DS, RAS no momento do cálculo';
