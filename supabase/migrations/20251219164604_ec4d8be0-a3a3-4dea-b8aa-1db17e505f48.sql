-- Adicionar colunas para telefone e email do aceitante
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS acceptor_phone TEXT,
ADD COLUMN IF NOT EXISTS acceptor_email TEXT;