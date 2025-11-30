import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  entity_type: 'accounts' | 'contacts' | 'opportunities' | 'products' | 'activities' | 'proposals' | 'loss_reasons' | 'origins' | 'territories';
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
    const validEntityTypes = ['accounts', 'contacts', 'opportunities', 'products', 'activities', 'proposals', 'loss_reasons', 'origins', 'territories'];
    if (!entity_type || !validEntityTypes.includes(entity_type)) {
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
    products: 'reference',
    activities: 'title',
    proposals: 'title',
    loss_reasons: 'name',
    origins: 'name',
    territories: 'name',
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

      if (entityType === 'activities') {
        // Auto-assign owner to current user if not provided
        if (!insertData.owner_user_id) {
          insertData.owner_user_id = userId;
        }
        
        // Set default status if not provided
        if (!insertData.status) {
          insertData.status = 'pending';
        }

        // Validate activity type
        const validTypes = ['call', 'meeting', 'email', 'task', 'note'];
        if (insertData.type && !validTypes.includes(insertData.type)) {
          insertData.type = 'task';
        }

        // Handle relationship linking via CNPJ/email
        if (insertData.account_cnpj) {
          const { data: account } = await supabase
            .from('accounts')
            .select('id')
            .eq('organization_id', orgId)
            .eq('cnpj', insertData.account_cnpj)
            .maybeSingle();
          
          if (account) {
            insertData.account_id = account.id;
          }
          delete insertData.account_cnpj;
        }

        if (insertData.contact_email) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .contains('emails', [insertData.contact_email])
            .maybeSingle();
          
          if (contact) {
            insertData.contact_id = contact.id;
          }
          delete insertData.contact_email;
        }

        if (insertData.opportunity_title) {
          const { data: opportunity } = await supabase
            .from('opportunities')
            .select('id')
            .eq('organization_id', orgId)
            .eq('title', insertData.opportunity_title)
            .maybeSingle();
          
          if (opportunity) {
            insertData.opportunity_id = opportunity.id;
          }
          delete insertData.opportunity_title;
        }

        // Combine date and time into scheduled_date
        if (insertData.scheduled_date && insertData.scheduled_time) {
          insertData.scheduled_date = `${insertData.scheduled_date}T${insertData.scheduled_time}:00`;
          delete insertData.scheduled_time;
        }
      }

      if (entityType === 'products') {
        // Validate product type
        if (!insertData.type || !['produto', 'serviço'].includes(insertData.type)) {
          insertData.type = 'produto';
        }

        // Set default unit
        if (!insertData.unit) {
          insertData.unit = 'un';
        }

        // Handle category linking
        if (insertData.category_name) {
          const { data: category } = await supabase
            .from('product_categories')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('name', insertData.category_name)
            .maybeSingle();
          
          if (category) {
            insertData.category_id = category.id;
          } else {
            // Create category if it doesn't exist
            const { data: newCategory } = await supabase
              .from('product_categories')
              .insert({
                organization_id: orgId,
                name: insertData.category_name,
                color: '#3b82f6',
              })
              .select('id')
              .single();
            
            if (newCategory) {
              insertData.category_id = newCategory.id;
            }
          }
          delete insertData.category_name;
        }

        // Ensure numeric fields
        if (insertData.price) insertData.price = parseFloat(insertData.price);
        if (insertData.cost) insertData.cost = parseFloat(insertData.cost);
        if (insertData.ipi_percent) insertData.ipi_percent = parseFloat(insertData.ipi_percent);
      }

      if (entityType === 'proposals') {
        // Set default status
        if (!insertData.status) {
          insertData.status = 'draft';
        }

        // Handle opportunity linking
        if (insertData.opportunity_title) {
          const { data: opportunity } = await supabase
            .from('opportunities')
            .select('id')
            .eq('organization_id', orgId)
            .eq('title', insertData.opportunity_title)
            .maybeSingle();
          
          if (opportunity) {
            insertData.opportunity_id = opportunity.id;
          }
          delete insertData.opportunity_title;
        }

        // Ensure numeric value
        if (insertData.value) insertData.value = parseFloat(insertData.value);

        // Generate proposal number if not provided
        if (!insertData.proposal_number) {
          const { data: org } = await supabase
            .from('organizations')
            .select('proposal_sequence, proposal_prefix')
            .eq('id', orgId)
            .single();
          
          if (org) {
            const year = new Date().getFullYear();
            const sequence = (org.proposal_sequence || 0) + 1;
            const prefix = org.proposal_prefix || 'PROP';
            insertData.proposal_number = `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
            
            await supabase
              .from('organizations')
              .update({ proposal_sequence: sequence })
              .eq('id', orgId);
          }
        }
      }

      if (entityType === 'loss_reasons') {
        // Set default active status
        if (insertData.is_active === undefined) {
          insertData.is_active = true;
        }
      }

      if (entityType === 'origins') {
        // Set default active status
        if (insertData.is_active === undefined) {
          insertData.is_active = true;
        }

        // Handle origin group linking/creation
        if (insertData.group_name) {
          const { data: group } = await supabase
            .from('origin_groups')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('name', insertData.group_name)
            .maybeSingle();
          
          if (group) {
            insertData.group_id = group.id;
          } else {
            // Create group if it doesn't exist
            const { data: newGroup } = await supabase
              .from('origin_groups')
              .insert({
                organization_id: orgId,
                name: insertData.group_name,
              })
              .select('id')
              .single();
            
            if (newGroup) {
              insertData.group_id = newGroup.id;
            }
          }
          delete insertData.group_name;
        }
      }

      if (entityType === 'territories') {
        // Set default type
        if (!insertData.type) {
          insertData.type = 'geographic';
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
