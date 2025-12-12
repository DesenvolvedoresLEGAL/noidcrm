
-- =====================================================
-- SPRINT 4: FUNÇÕES DE MONITORAMENTO DE PERFORMANCE
-- =====================================================

-- Função para verificar uso de índices por tabela
CREATE OR REPLACE FUNCTION public.get_index_usage_stats()
RETURNS TABLE(
    schema_name text,
    table_name text,
    index_name text,
    index_scans bigint,
    sequential_scans bigint,
    index_usage_percent numeric,
    index_size text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT
        i.schemaname::text as schema_name,
        i.relname::text as table_name,
        i.indexrelname::text as index_name,
        i.idx_scan as index_scans,
        t.seq_scan as sequential_scans,
        CASE 
            WHEN (i.idx_scan + t.seq_scan) = 0 THEN 0
            ELSE ROUND((i.idx_scan::numeric / NULLIF(i.idx_scan + t.seq_scan, 0)) * 100, 2)
        END as index_usage_percent,
        pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size
    FROM pg_stat_user_indexes i
    JOIN pg_stat_user_tables t ON i.schemaname = t.schemaname AND i.relname = t.relname
    WHERE i.schemaname = 'public'
    ORDER BY t.seq_scan DESC
$$;

-- Função para identificar tabelas que precisam de índices
CREATE OR REPLACE FUNCTION public.get_tables_needing_indexes()
RETURNS TABLE(
    schema_name text,
    table_name text,
    sequential_scans bigint,
    index_scans bigint,
    index_usage_percent numeric,
    estimated_rows bigint,
    total_size text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT
        schemaname::text as schema_name,
        relname::text as table_name,
        seq_scan as sequential_scans,
        idx_scan as index_scans,
        CASE 
            WHEN (idx_scan + seq_scan) = 0 THEN 0
            ELSE ROUND((idx_scan::numeric / NULLIF(idx_scan + seq_scan, 0)) * 100, 2)
        END as index_usage_percent,
        n_live_tup as estimated_rows,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND seq_scan > 1000
      AND (idx_scan::numeric / NULLIF(idx_scan + seq_scan, 0)) < 0.5
    ORDER BY seq_scan DESC
    LIMIT 20
$$;

-- Função para verificar saúde dos índices
CREATE OR REPLACE FUNCTION public.check_index_health()
RETURNS TABLE(
    table_name text,
    index_name text,
    index_usage_percent numeric,
    recommendation text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT
        t.relname::text as table_name,
        i.indexrelname::text as index_name,
        CASE 
            WHEN (i.idx_scan + t.seq_scan) = 0 THEN 0
            ELSE ROUND((i.idx_scan::numeric / NULLIF(i.idx_scan + t.seq_scan, 0)) * 100, 2)
        END as index_usage_percent,
        CASE
            WHEN i.idx_scan = 0 THEN 'Índice nunca usado - considerar remoção'
            WHEN (i.idx_scan::numeric / NULLIF(i.idx_scan + t.seq_scan, 0)) < 0.3 THEN 'Baixo uso - revisar necessidade'
            WHEN (i.idx_scan::numeric / NULLIF(i.idx_scan + t.seq_scan, 0)) > 0.9 THEN 'Excelente uso'
            ELSE 'Uso moderado'
        END as recommendation
    FROM pg_stat_user_indexes i
    JOIN pg_stat_user_tables t ON i.schemaname = t.schemaname AND i.relname = t.relname
    WHERE i.schemaname = 'public'
    ORDER BY index_usage_percent ASC
    LIMIT 50
$$;

-- Função para obter resumo de performance do banco
CREATE OR REPLACE FUNCTION public.get_database_performance_summary()
RETURNS TABLE(
    metric text,
    value text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT 'Total de tabelas'::text as metric, COUNT(*)::text as value FROM pg_stat_user_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Total de índices'::text, COUNT(*)::text FROM pg_stat_user_indexes WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Sequential scans totais'::text, SUM(seq_scan)::text FROM pg_stat_user_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Index scans totais'::text, SUM(idx_scan)::text FROM pg_stat_user_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Tabelas com baixo uso de índice (<50%)'::text, COUNT(*)::text 
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public' 
      AND seq_scan > 1000
      AND (idx_scan::numeric / NULLIF(idx_scan + seq_scan, 0)) < 0.5
$$;

-- Tabela para registrar histórico de performance (opcional)
CREATE TABLE IF NOT EXISTS public.performance_metrics_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date timestamp with time zone DEFAULT now(),
    total_seq_scans bigint,
    total_idx_scans bigint,
    tables_low_index_usage integer,
    notes text
);

-- Habilitar RLS
ALTER TABLE public.performance_metrics_log ENABLE ROW LEVEL SECURITY;

-- Policy para admins verem métricas
CREATE POLICY "Admins can view performance metrics"
ON public.performance_metrics_log
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND org_role IN ('owner', 'admin')
    )
);

-- Policy para sistema inserir métricas
CREATE POLICY "System can insert performance metrics"
ON public.performance_metrics_log
FOR INSERT
WITH CHECK (true);
