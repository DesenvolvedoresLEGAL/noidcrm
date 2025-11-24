import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  entity_type: 'accounts' | 'contacts' | 'opportunities';
  data: any[];
  import_log_id: string;
  operation_mode?: 'insert' | 'upsert';
  upsert_settings?: {
    unique_field: string;
    update_strategy: 'merge' | 'replace';
  };
}

interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  warningCount: number;
  updateCount: number;
  errors: Array<{ row: number; message: string; }>;
  importedIds: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { entity_type, data, import_log_id, operation_mode = 'insert', upsert_settings }: ImportRequest = await req.json();

    // Input validation
    if (!entity_type || !['accounts', 'contacts', 'opportunities'].includes(entity_type)) {
      return new Response(JSON.stringify({ error: 'Invalid entity type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ error: 'No data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (data.length > 5000) {
      return new Response(JSON.stringify({ error: 'Maximum 5000 rows allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update import log status to processing
    await supabaseClient
      .from('import_logs')
      .update({ status: 'processing' })
      .eq('id', import_log_id);

    const result: ImportResult = {
      success: true,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      updateCount: 0,
      errors: [],
      importedIds: [],
    };

    // Execute import (with UPSERT support)
    await executeImport(supabaseClient, entity_type, data, orgMember.organization_id, user.id, result, operation_mode, upsert_settings);

    // Update import log with final results
    await supabaseClient
      .from('import_logs')
      .update({
        status: result.errorCount === 0 ? 'completed' : 'failed',
        success_count: result.successCount,
        error_count: result.errorCount,
        warning_count: result.warningCount,
        update_count: result.updateCount,
        operation_mode: operation_mode,
        upsert_settings: upsert_settings || {},
        error_details: result.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', import_log_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Import execution error:', error);
    return new Response(
      JSON.stringify({ error: 'Import failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function executeImport(
  supabase: any,
  entityType: string,
  data: any[],
  orgId: string,
  userId: string,
  result: ImportResult,
  operationMode: 'insert' | 'upsert' = 'insert',
  upsertSettings?: { unique_field: string; update_strategy: 'merge' | 'replace' }
) {
  // Define unique fields for each entity type
  const UNIQUE_FIELDS: Record<string, string> = {
    accounts: 'cnpj',
    contacts: 'emails',
    opportunities: 'title',
  };

  const uniqueField = upsertSettings?.unique_field || UNIQUE_FIELDS[entityType];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    try {
      let insertData: any = {
        organization_id: orgId,
        ...row,
      };

      // Add entity-specific defaults
      if (entityType === 'opportunities') {
        insertData.owner_user_id = userId;
        
        // Set default pipeline and stage if not provided
        if (!insertData.pipeline_id) {
          const { data: defaultPipeline } = await supabase
            .from('pipelines')
            .select('id, stages:stages(id)')
            .eq('organization_id', orgId)
            .order('created_at')
            .limit(1)
            .single();

          if (defaultPipeline) {
            insertData.pipeline_id = defaultPipeline.id;
            if (defaultPipeline.stages && defaultPipeline.stages.length > 0) {
              insertData.stage_id = defaultPipeline.stages[0].id;
            }
          }
        }
      }

      // UPSERT logic
      if (operationMode === 'upsert' && uniqueField && insertData[uniqueField]) {
        const uniqueValue = insertData[uniqueField];
        
        // Check if record exists
        let query = supabase
          .from(entityType)
          .select('id')
          .eq('organization_id', orgId);

        // Handle array fields (like emails for contacts)
        if (uniqueField === 'emails' && Array.isArray(uniqueValue)) {
          query = query.contains(uniqueField, uniqueValue);
        } else {
          query = query.eq(uniqueField, uniqueValue);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          // UPDATE existing record
          const { data: updated, error } = await supabase
            .from(entityType)
            .update(insertData)
            .eq('id', existing.id)
            .select('id')
            .single();

          if (error) {
            result.errorCount++;
            result.errors.push({
              row: i,
              message: error.message || 'Erro ao atualizar registro',
            });
          } else {
            result.updateCount++;
            result.importedIds.push(updated.id);

            // Log audit entry for update
            await supabase.from('audit_log').insert({
              organization_id: orgId,
              actor_user_id: userId,
              action: 'import_updated',
              entity_type: entityType.slice(0, -1),
              entity_id: updated.id,
              metadata: { imported_from_file: true, operation: 'upsert' },
            });
          }
          continue;
        }
      }

      // INSERT new record (default behavior or upsert with no match)
      const { data: inserted, error } = await supabase
        .from(entityType)
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        result.errorCount++;
        result.errors.push({
          row: i,
          message: error.message || 'Erro ao inserir registro',
        });
      } else {
        result.successCount++;
        result.importedIds.push(inserted.id);

        // Log audit entry
        await supabase.from('audit_log').insert({
          organization_id: orgId,
          actor_user_id: userId,
          action: 'import_created',
          entity_type: entityType.slice(0, -1),
          entity_id: inserted.id,
          metadata: { imported_from_file: true },
        });
      }
    } catch (error: any) {
      result.errorCount++;
      result.errors.push({
        row: i,
        message: error.message || 'Erro desconhecido',
      });
    }
  }

  result.success = result.errorCount === 0;
}
