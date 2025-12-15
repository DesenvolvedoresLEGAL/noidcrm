-- ========================================
-- CORRIGIR POLÍTICAS DE PROPOSALS
-- ========================================

-- Remover política muito permissiva (vê tudo da org)
DROP POLICY IF EXISTS "Org members view proposals" ON proposals;

-- Remover política duplicada muito permissiva
DROP POLICY IF EXISTS "Users can view proposals in their organization" ON proposals;

-- ========================================
-- CORRIGIR POLÍTICAS DE OPPORTUNITIES
-- ========================================

-- Remover política muito permissiva (vê tudo da org)
DROP POLICY IF EXISTS "Org members view opportunities" ON opportunities;