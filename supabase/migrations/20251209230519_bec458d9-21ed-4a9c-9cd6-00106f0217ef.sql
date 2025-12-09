-- Corrigir pipeline_type de ALUGUE: CS para onboarding (pós-venda)
UPDATE pipelines 
SET pipeline_type = 'onboarding' 
WHERE id = '97a78715-c2e5-426c-b248-979b7718af03';

-- Adicionar comentário para documentar os tipos de pipeline
COMMENT ON COLUMN pipelines.pipeline_type IS 'Tipo do pipeline: qualification (pré-vendas), sales (vendas), onboarding (ativação pós-venda), customer_success (CS contínuo), renewal (renovação)';