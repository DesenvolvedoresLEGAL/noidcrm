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
  batch_index?: number;
  total_batches?: number;
}

interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  warningCount: number;
  updateCount: number;
  relationshipCount?: number;
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

    // Get user's organization (handles multiple org memberships by ordering)
    console.log('Looking for organization for user_id:', user.id);
    
    const { data: orgMembers, error: orgError } = await supabaseClient
      .from('organization_members')
      .select('organization_id, status, joined_at')
      .eq('user_id', user.id);

    console.log('Organization query result:', { orgMembers, orgError, count: orgMembers?.length });

    if (orgError) {
      console.error('Database error fetching organization:', orgError);
      return new Response(JSON.stringify({ error: 'Database error', details: orgError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!orgMembers || orgMembers.length === 0) {
      console.error('No organization memberships found for user:', user.id);
      return new Response(JSON.stringify({ error: 'User does not belong to any organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter active memberships and sort by joined_at
    const activeMemberships = orgMembers
      .filter(m => m.status === 'active')
      .sort((a, b) => {
        if (!a.joined_at && !b.joined_at) return 0;
        if (!a.joined_at) return 1;
        if (!b.joined_at) return -1;
        return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
      });

    if (activeMemberships.length === 0) {
      console.error('User has memberships but none are active:', orgMembers);
      return new Response(JSON.stringify({ error: 'No active organization membership found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = activeMemberships[0].organization_id;
    console.log('Using organization_id:', organizationId);

    const { entity_type, data, import_log_id, operation_mode = 'insert', upsert_settings, batch_index, total_batches }: ImportRequest = await req.json();

    console.log(`Processing batch ${(batch_index || 0) + 1}/${total_batches || 1} with ${data.length} records for ${entity_type}`);

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

    if (data.length > 1000) {
      return new Response(JSON.stringify({ error: 'Maximum 1000 rows per batch allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    await executeImport(supabaseClient, entity_type, data, organizationId, user.id, result, operation_mode, upsert_settings);

    console.log(`Batch ${(batch_index || 0) + 1}/${total_batches || 1} completed: ${result.successCount} success, ${result.errorCount} errors`);

    // Return batch results (frontend will aggregate and update final import log)
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

      // Add entity-specific defaults and parsing
      if (entityType === 'accounts') {
        // Parse capital_social (handle "10000" or "10.000,00" formats)
        if (insertData.capital_social) {
          const capitalStr = String(insertData.capital_social).replace(/\./g, '').replace(',', '.');
          insertData.capital_social = parseFloat(capitalStr) || null;
        }

        // Parse telefones (convert string to array)
        if (insertData.telefones && typeof insertData.telefones === 'string') {
          insertData.telefones = insertData.telefones.split(';').map((t: string) => t.trim()).filter(Boolean);
        }

        // Parse emails (convert string to array)
        if (insertData.emails && typeof insertData.emails === 'string') {
          insertData.emails = insertData.emails.split(';').map((e: string) => e.trim()).filter(Boolean);
        }

        // Parse cnaes_secundarios (convert string to array)
        if (insertData.cnaes_secundarios && typeof insertData.cnaes_secundarios === 'string') {
          insertData.cnaes_secundarios = insertData.cnaes_secundarios.split(';').map((c: string) => c.trim()).filter(Boolean);
        }

        // Map owner_email to owner_user_id
        if (insertData.owner_email) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', insertData.owner_email)
            .maybeSingle();
          
          if (ownerProfile) {
            insertData.owner_user_id = ownerProfile.user_id;
          }
          delete insertData.owner_email;
        }

        // Store tags and regioes in observacoes (temporary solution)
        let notesArray: string[] = [];
        
        if (insertData.tags) {
          notesArray.push(`[TAGS: ${insertData.tags}]`);
          delete insertData.tags;
        }
        
        if (insertData.regioes) {
          notesArray.push(`[REGIÕES: ${insertData.regioes}]`);
          delete insertData.regioes;
        }

        if (notesArray.length > 0) {
          const existingNotes = insertData.observacoes || '';
          insertData.observacoes = `${existingNotes}\n\n${notesArray.join('\n')}`.trim();
        }

        // Store contact data for later processing
        const contactsToCreate: any[] = [];

        // Responsável Legal
        if (insertData.nome_responsavel_legal && insertData.email_responsavel_legal) {
          contactsToCreate.push({
            nome: insertData.nome_responsavel_legal,
            emails: [insertData.email_responsavel_legal],
            telefones: insertData.whatsapp_responsavel_legal ? [insertData.whatsapp_responsavel_legal] : [],
            cargo: 'Responsável Legal',
          });
          delete insertData.nome_responsavel_legal;
          delete insertData.email_responsavel_legal;
          delete insertData.whatsapp_responsavel_legal;
        }

        // Responsável Financeiro
        if (insertData.nome_responsavel_financeiro && insertData.email_responsavel_financeiro) {
          contactsToCreate.push({
            nome: insertData.nome_responsavel_financeiro,
            emails: [insertData.email_responsavel_financeiro],
            telefones: insertData.whatsapp_responsavel_financeiro ? [insertData.whatsapp_responsavel_financeiro] : [],
            cargo: 'Responsável Financeiro',
          });
          delete insertData.nome_responsavel_financeiro;
          delete insertData.email_responsavel_financeiro;
          delete insertData.whatsapp_responsavel_financeiro;
        }

        // Store contacts data temporarily (will be processed after account creation)
        insertData._contacts_to_create = contactsToCreate;
      }

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
      // Extract contacts to create (only for accounts)
      const contactsToCreate = insertData._contacts_to_create || [];
      delete insertData._contacts_to_create;

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

        // Auto-create contacts for accounts
        if (entityType === 'accounts' && contactsToCreate.length > 0) {
          for (const contactData of contactsToCreate) {
            try {
              const { error: contactError } = await supabase
                .from('contacts')
                .insert({
                  organization_id: orgId,
                  account_id: inserted.id,
                  ...contactData,
                });

              if (!contactError) {
                // Track relationship creation in result
                if (!result.relationshipCount) result.relationshipCount = 0;
                result.relationshipCount++;
              }
            } catch (contactError: any) {
              // Silently log contact creation failures (don't fail entire import)
              console.error(`Failed to create contact for account ${inserted.id}:`, contactError);
            }
          }
        }
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
