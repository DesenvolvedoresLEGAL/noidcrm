import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, include_deleted = false, include_schema = true, format = 'json' } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[export-full-backup] Starting full backup for org: ${organization_id}`);

    // Create backup record
    const { data: backupRecord, error: backupError } = await supabase
      .from('backup_history')
      .insert({
        organization_id,
        backup_type: 'export',
        status: 'in_progress',
      })
      .select()
      .single();

    if (backupError) {
      console.error('[export-full-backup] Error creating backup record:', backupError);
    }

    // Fetch organization data
    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organization_id)
      .single();

    // Define tables to export with their configurations
    const tablesToExport = [
      { name: 'organizations', filter: { id: organization_id } },
      { name: 'profiles', filter: { organization_id } },
      { name: 'user_organizations', filter: { organization_id } },
      { name: 'pipelines', filter: { organization_id } },
      { name: 'pipeline_stages', filter: { organization_id } },
      { name: 'accounts', filter: { organization_id }, softDelete: true },
      { name: 'contacts', filter: { organization_id }, softDelete: true },
      { name: 'opportunities', filter: { organization_id }, softDelete: true },
      { name: 'activities', filter: { organization_id }, softDelete: true },
      { name: 'proposals', filter: { organization_id }, softDelete: true },
      { name: 'interaction_events', filter: { organization_id } },
      { name: 'win_loss_records', filter: { organization_id } },
      { name: 'loss_reasons', filter: { organization_id } },
      { name: 'win_reasons', filter: { organization_id } },
      { name: 'ai_memories', filter: { organization_id } },
      { name: 'ai_insights', filter: { organization_id } },
      { name: 'ai_playbooks', filter: { organization_id } },
      { name: 'sellers', filter: { organization_id } },
      { name: 'teams', filter: { organization_id } },
      { name: 'goals', filter: { organization_id } },
      { name: 'crm_settings', filter: { organization_id } },
      { name: 'email_templates', filter: { organization_id } },
      { name: 'custom_fields', filter: { organization_id } },
      { name: 'tags', filter: { organization_id } },
      { name: 'account_partners', filter: { organization_id } },
    ];

    const exportData: Record<string, any[]> = {};
    const entityCounts: Record<string, number> = {};

    // Fetch data from each table
    for (const table of tablesToExport) {
      try {
        let query = supabase.from(table.name).select('*');
        
        // Apply organization filter
        for (const [key, value] of Object.entries(table.filter)) {
          query = query.eq(key, value);
        }

        // Handle soft deletes
        if (table.softDelete && !include_deleted) {
          query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) {
          console.warn(`[export-full-backup] Error fetching ${table.name}:`, error.message);
          exportData[table.name] = [];
          entityCounts[table.name] = 0;
        } else {
          exportData[table.name] = data || [];
          entityCounts[table.name] = data?.length || 0;
          console.log(`[export-full-backup] Fetched ${data?.length || 0} records from ${table.name}`);
        }
      } catch (err) {
        console.warn(`[export-full-backup] Table ${table.name} might not exist:`, err);
        exportData[table.name] = [];
        entityCounts[table.name] = 0;
      }
    }

    // Generate schema DDL
    const schemaDDL = include_schema ? generateSchemaDDL() : null;

    // Build final export object
    const fullBackup = {
      version: '2.0',
      type: 'full_portable_backup',
      exported_at: new Date().toISOString(),
      organization: {
        id: organization_id,
        name: organization?.name || 'Unknown',
      },
      options: {
        include_deleted,
        include_schema,
        format,
      },
      statistics: {
        total_records: Object.values(entityCounts).reduce((a, b) => a + b, 0),
        tables_exported: Object.keys(entityCounts).length,
        entity_counts: entityCounts,
      },
      schema: schemaDDL,
      data: exportData,
      restore_instructions: getRestoreInstructions(),
    };

    // Update backup record
    if (backupRecord) {
      await supabase
        .from('backup_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          entities_count: entityCounts,
          size_bytes: JSON.stringify(fullBackup).length,
        })
        .eq('id', backupRecord.id);
    }

    // Return based on format
    if (format === 'sql') {
      const sqlScript = generateSQLScript(fullBackup);
      return new Response(sqlScript, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="noid-backup-${organization_id}-${new Date().toISOString().split('T')[0]}.sql"`,
        },
      });
    }

    return new Response(JSON.stringify(fullBackup, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="noid-backup-${organization_id}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export-full-backup] Unexpected error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateSchemaDDL(): object {
  return {
    enums: [
      `CREATE TYPE IF NOT EXISTS tipo_pessoa_type AS ENUM ('pf', 'pj');`,
      `CREATE TYPE IF NOT EXISTS accelerator_tier_type AS ENUM ('bronze', 'silver', 'gold', 'platinum');`,
    ],
    tables: [
      // Core tables DDL
      `-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Pipelines table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'sales',
  is_default BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Pipeline stages table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability NUMERIC DEFAULT 0,
  color TEXT,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  cpf TEXT,
  tipo_pessoa tipo_pessoa_type DEFAULT 'pj',
  segmento TEXT,
  cidade TEXT,
  uf TEXT,
  emails TEXT[],
  telefones JSONB,
  website TEXT,
  lifecycle_stage TEXT,
  owner_user_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  account_id UUID REFERENCES public.accounts(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_primary BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  account_id UUID REFERENCES public.accounts(id),
  pipeline_id UUID REFERENCES public.pipelines(id),
  stage_id UUID REFERENCES public.pipeline_stages(id),
  name TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  probability NUMERIC,
  expected_close_date DATE,
  status TEXT DEFAULT 'open',
  owner_user_id UUID,
  temperature TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Activities table
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  account_id UUID REFERENCES public.accounts(id),
  contact_id UUID REFERENCES public.contacts(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  owner_user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
      `-- Proposals table
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  account_id UUID REFERENCES public.accounts(id),
  title TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  valid_until DATE,
  content JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`,
    ],
    rls_policies: [
      `-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;`,
    ],
  };
}

function getRestoreInstructions(): string {
  return `
# Instruções de Restauração - NOID Revenue Backup

## Opção 1: Restauração via SQL Editor (Recomendado)

1. Acesse o Supabase Dashboard do projeto de destino
2. Vá em SQL Editor
3. Execute primeiro os comandos de schema (seção "schema" deste backup)
4. Em seguida, use os scripts de INSERT para restaurar os dados

## Opção 2: Restauração via API

1. Use o endpoint de import do NOID (se disponível)
2. Faça upload deste arquivo JSON
3. O sistema processará automaticamente

## Notas Importantes

- Certifique-se de que as extensões necessárias estão habilitadas (uuid-ossp, etc.)
- IDs UUID serão mantidos para preservar relacionamentos
- Ajuste as foreign keys conforme necessário se os IDs de auth.users forem diferentes
- Revise as RLS policies após a restauração

## Ordem de Restauração Recomendada

1. organizations
2. profiles
3. pipelines
4. pipeline_stages
5. accounts
6. contacts
7. opportunities
8. activities
9. proposals
10. Demais tabelas
`;
}

function generateSQLScript(backup: any): string {
  let sql = `-- =====================================================
-- NOID Revenue - Full Backup Restore Script
-- Organization: ${backup.organization.name}
-- Exported at: ${backup.exported_at}
-- Total records: ${backup.statistics.total_records}
-- =====================================================

`;

  // Add schema if included
  if (backup.schema) {
    sql += `-- =====================================================\n`;
    sql += `-- SCHEMA DEFINITIONS\n`;
    sql += `-- =====================================================\n\n`;

    sql += `-- Enums\n`;
    for (const enumSql of backup.schema.enums) {
      sql += enumSql + '\n';
    }

    sql += `\n-- Tables\n`;
    for (const tableSql of backup.schema.tables) {
      sql += tableSql + '\n\n';
    }

    sql += `-- RLS Policies\n`;
    for (const rlsSql of backup.schema.rls_policies) {
      sql += rlsSql + '\n';
    }
  }

  sql += `\n-- =====================================================\n`;
  sql += `-- DATA INSERTS\n`;
  sql += `-- =====================================================\n\n`;

  // Generate INSERT statements for each table
  const tableOrder = [
    'organizations', 'profiles', 'user_organizations',
    'pipelines', 'pipeline_stages',
    'accounts', 'contacts', 'opportunities',
    'activities', 'proposals',
  ];

  for (const tableName of tableOrder) {
    const data = backup.data[tableName];
    if (data && data.length > 0) {
      sql += `-- ${tableName} (${data.length} records)\n`;
      for (const row of data) {
        const columns = Object.keys(row).filter(k => row[k] !== null);
        const values = columns.map(k => {
          const v = row[k];
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        });
        sql += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
      }
      sql += '\n';
    }
  }

  // Add remaining tables not in the order list
  for (const [tableName, data] of Object.entries(backup.data)) {
    if (!tableOrder.includes(tableName) && Array.isArray(data) && data.length > 0) {
      sql += `-- ${tableName} (${data.length} records)\n`;
      for (const row of data as any[]) {
        const columns = Object.keys(row).filter(k => row[k] !== null);
        const values = columns.map(k => {
          const v = row[k];
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        });
        sql += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
      }
      sql += '\n';
    }
  }

  sql += `-- =====================================================\n`;
  sql += `-- END OF BACKUP SCRIPT\n`;
  sql += `-- =====================================================\n`;

  return sql;
}
