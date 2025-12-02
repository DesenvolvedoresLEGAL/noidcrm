import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelationshipRequest {
  entity_type: 'accounts' | 'contacts' | 'opportunities' | 'activities' | 'proposals' | 'products';
  data: any[];
  relationship_hints?: {
    company_cnpj_column?: string;
    contact_email_column?: string;
    account_name_column?: string;
    opportunity_title_column?: string;
    category_name_column?: string;
  };
  auto_create_missing?: boolean; // Opção para criar relacionamentos em cascata
}

interface RelationshipResult {
  success: boolean;
  updated_data: any[];
  relationships_found: number;
  relationships_by_type: Record<string, number>;
  errors: Array<{ row: number; message: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Service role client for database operations
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // User-context client for RPC calls that need auth.uid()
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization using user-context client for auth.uid() to work
    const { data: organizationId, error: orgError } = await userClient
      .rpc('get_user_organization_id');

    if (orgError || !organizationId) {
      console.error('Organization lookup error:', orgError);
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = organizationId;

    const { entity_type, data, relationship_hints = {}, auto_create_missing = false }: RelationshipRequest = await req.json();

    const result: RelationshipResult = {
      success: true,
      updated_data: [],
      relationships_found: 0,
      relationships_by_type: {},
      errors: [],
    };

    // Process relationships based on entity type
    if (entity_type === 'contacts') {
      result.updated_data = await linkContactsToAccounts(
        supabaseClient,
        data,
        orgId,
        relationship_hints,
        result,
        auto_create_missing
      );
    } else if (entity_type === 'opportunities') {
      result.updated_data = await linkOpportunitiesToEntities(
        supabaseClient,
        data,
        orgId,
        relationship_hints,
        result
      );
    } else if (entity_type === 'activities') {
      result.updated_data = await linkActivitiesToEntities(
        supabaseClient,
        data,
        orgId,
        relationship_hints,
        result,
        auto_create_missing
      );
    } else if (entity_type === 'proposals') {
      result.updated_data = await linkProposalsToOpportunities(
        supabaseClient,
        data,
        orgId,
        relationship_hints,
        result
      );
    } else if (entity_type === 'products') {
      result.updated_data = await linkProductsToCategories(
        supabaseClient,
        data,
        orgId,
        relationship_hints,
        result,
        auto_create_missing
      );
    } else {
      // No automatic relationships for accounts
      result.updated_data = data;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Relationship detection error:', error);
    return new Response(
      JSON.stringify({ error: 'Relationship detection failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Link contacts to accounts via CNPJ
async function linkContactsToAccounts(
  supabase: any,
  contacts: any[],
  orgId: string,
  hints: any,
  result: RelationshipResult,
  autoCreate: boolean = false
): Promise<any[]> {
  const updatedContacts = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = { ...contacts[i] };
    
    try {
      // Look for CNPJ in various possible fields
      const cnpjFields = ['company_cnpj', 'cnpj_empresa', 'cnpj', hints.company_cnpj_column];
      let companyCnpj = null;

      for (const field of cnpjFields) {
        if (field && contact[field]) {
          companyCnpj = contact[field];
          break;
        }
      }

      if (companyCnpj) {
        // Find matching account
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('cnpj', companyCnpj)
          .eq('organization_id', orgId)
          .maybeSingle();

        if (account) {
          contact.account_id = account.id;
          result.relationships_found++;
          result.relationships_by_type['contact_to_account'] = 
            (result.relationships_by_type['contact_to_account'] || 0) + 1;
        }
      }
    } catch (error: any) {
      result.errors.push({
        row: i,
        message: `Erro ao vincular contato: ${error.message}`,
      });
    }

    updatedContacts.push(contact);
  }

  return updatedContacts;
}

// Link opportunities to accounts and contacts
async function linkOpportunitiesToEntities(
  supabase: any,
  opportunities: any[],
  orgId: string,
  hints: any,
  result: RelationshipResult
): Promise<any[]> {
  const updatedOpportunities = [];

  for (let i = 0; i < opportunities.length; i++) {
    const opp = { ...opportunities[i] };
    
    try {
      // Link to account via CNPJ
      const cnpjFields = ['company_cnpj', 'cnpj_empresa', 'cnpj', hints.company_cnpj_column];
      let companyCnpj = null;

      for (const field of cnpjFields) {
        if (field && opp[field]) {
          companyCnpj = opp[field];
          break;
        }
      }

      if (companyCnpj && !opp.account_id) {
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('cnpj', companyCnpj)
          .eq('organization_id', orgId)
          .maybeSingle();

        if (account) {
          opp.account_id = account.id;
          result.relationships_found++;
          result.relationships_by_type['opportunity_to_account'] = 
            (result.relationships_by_type['opportunity_to_account'] || 0) + 1;
        }
      }

      // Link to contact via Email
      const emailFields = ['contact_email', 'email_contato', 'email', hints.contact_email_column];
      let contactEmail = null;

      for (const field of emailFields) {
        if (field && opp[field]) {
          contactEmail = opp[field];
          break;
        }
      }

      if (contactEmail && !opp.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .contains('emails', [contactEmail])
          .maybeSingle();

        if (contact) {
          opp.contact_id = contact.id;
          result.relationships_found++;
          result.relationships_by_type['opportunity_to_contact'] = 
            (result.relationships_by_type['opportunity_to_contact'] || 0) + 1;
        }
      }
    } catch (error: any) {
      result.errors.push({
        row: i,
        message: `Erro ao vincular oportunidade: ${error.message}`,
      });
    }

    updatedOpportunities.push(opp);
  }

  return updatedOpportunities;
}

// Link activities to accounts, contacts, and opportunities
async function linkActivitiesToEntities(
  supabase: any,
  activities: any[],
  orgId: string,
  hints: any,
  result: RelationshipResult,
  autoCreate: boolean = false
): Promise<any[]> {
  const updatedActivities = [];

  for (let i = 0; i < activities.length; i++) {
    const activity = { ...activities[i] };
    
    try {
      // Link to account via CNPJ or razão_social
      const cnpjFields = ['company_cnpj', 'cnpj_empresa', 'cnpj', hints.company_cnpj_column];
      const nameFields = ['company_name', 'razao_social', 'empresa', hints.account_name_column];
      let accountId = null;

      // Try CNPJ first
      for (const field of cnpjFields) {
        if (field && activity[field]) {
          const { data: account } = await supabase
            .from('accounts')
            .select('id')
            .eq('cnpj', activity[field])
            .eq('organization_id', orgId)
            .maybeSingle();

          if (account) {
            accountId = account.id;
            break;
          }
        }
      }

      // Try razão_social if CNPJ not found
      if (!accountId) {
        for (const field of nameFields) {
          if (field && activity[field]) {
            const { data: account } = await supabase
              .from('accounts')
              .select('id')
              .eq('razao_social', activity[field])
              .eq('organization_id', orgId)
              .maybeSingle();

            if (account) {
              accountId = account.id;
              break;
            } else if (autoCreate) {
              // Create account automatically
              const { data: newAccount, error } = await supabase
                .from('accounts')
                .insert({
                  organization_id: orgId,
                  razao_social: activity[field],
                })
                .select('id')
                .single();

              if (newAccount && !error) {
                accountId = newAccount.id;
                result.relationships_by_type['activity_account_created'] = 
                  (result.relationships_by_type['activity_account_created'] || 0) + 1;
              }
            }
            break;
          }
        }
      }

      if (accountId) {
        activity.account_id = accountId;
        result.relationships_found++;
        result.relationships_by_type['activity_to_account'] = 
          (result.relationships_by_type['activity_to_account'] || 0) + 1;
      } else if (!autoCreate) {
        result.errors.push({
          row: i,
          message: 'Empresa não encontrada. Considere ativar criação automática.',
        });
      }

      // Link to contact via email
      const emailFields = ['contact_email', 'email_contato', 'email', hints.contact_email_column];
      let contactEmail = null;

      for (const field of emailFields) {
        if (field && activity[field]) {
          contactEmail = activity[field];
          break;
        }
      }

      if (contactEmail) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .contains('emails', [contactEmail])
          .maybeSingle();

        if (contact) {
          activity.contact_id = contact.id;
          result.relationships_found++;
          result.relationships_by_type['activity_to_contact'] = 
            (result.relationships_by_type['activity_to_contact'] || 0) + 1;
        }
      }

      // Link to opportunity via title
      const oppTitleFields = ['opportunity_title', 'titulo_oportunidade', 'oportunidade', hints.opportunity_title_column];
      let oppTitle = null;

      for (const field of oppTitleFields) {
        if (field && activity[field]) {
          oppTitle = activity[field];
          break;
        }
      }

      if (oppTitle) {
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('title', oppTitle)
          .maybeSingle();

        if (opportunity) {
          activity.opportunity_id = opportunity.id;
          result.relationships_found++;
          result.relationships_by_type['activity_to_opportunity'] = 
            (result.relationships_by_type['activity_to_opportunity'] || 0) + 1;
        }
      }
    } catch (error: any) {
      result.errors.push({
        row: i,
        message: `Erro ao vincular atividade: ${error.message}`,
      });
    }

    updatedActivities.push(activity);
  }

  return updatedActivities;
}

// Link proposals to opportunities
async function linkProposalsToOpportunities(
  supabase: any,
  proposals: any[],
  orgId: string,
  hints: any,
  result: RelationshipResult
): Promise<any[]> {
  const updatedProposals = [];

  for (let i = 0; i < proposals.length; i++) {
    const proposal = { ...proposals[i] };
    
    try {
      // Link to opportunity via title
      const oppTitleFields = ['opportunity_title', 'titulo_oportunidade', 'oportunidade', hints.opportunity_title_column];
      let oppTitle = null;

      for (const field of oppTitleFields) {
        if (field && proposal[field]) {
          oppTitle = proposal[field];
          break;
        }
      }

      if (oppTitle && !proposal.opportunity_id) {
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('title', oppTitle)
          .maybeSingle();

        if (opportunity) {
          proposal.opportunity_id = opportunity.id;
          result.relationships_found++;
          result.relationships_by_type['proposal_to_opportunity'] = 
            (result.relationships_by_type['proposal_to_opportunity'] || 0) + 1;
        } else {
          result.errors.push({
            row: i,
            message: `Oportunidade "${oppTitle}" não encontrada`,
          });
        }
      }
    } catch (error: any) {
      result.errors.push({
        row: i,
        message: `Erro ao vincular proposta: ${error.message}`,
      });
    }

    updatedProposals.push(proposal);
  }

  return updatedProposals;
}

// Link products to categories
async function linkProductsToCategories(
  supabase: any,
  products: any[],
  orgId: string,
  hints: any,
  result: RelationshipResult,
  autoCreate: boolean = false
): Promise<any[]> {
  const updatedProducts = [];

  for (let i = 0; i < products.length; i++) {
    const product = { ...products[i] };
    
    try {
      // Link to category via name
      const categoryFields = ['category_name', 'categoria', 'nome_categoria', hints.category_name_column];
      let categoryName = null;

      for (const field of categoryFields) {
        if (field && product[field]) {
          categoryName = product[field];
          break;
        }
      }

      if (categoryName && !product.category_id) {
        const { data: category } = await supabase
          .from('product_categories')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('name', categoryName)
          .maybeSingle();

        if (category) {
          product.category_id = category.id;
          result.relationships_found++;
          result.relationships_by_type['product_to_category'] = 
            (result.relationships_by_type['product_to_category'] || 0) + 1;
        } else if (autoCreate) {
          // Create category automatically
          const { data: newCategory, error } = await supabase
            .from('product_categories')
            .insert({
              organization_id: orgId,
              name: categoryName,
              color: '#3b82f6', // Default blue
              is_active: true,
            })
            .select('id')
            .single();

          if (newCategory && !error) {
            product.category_id = newCategory.id;
            result.relationships_found++;
            result.relationships_by_type['product_category_created'] = 
              (result.relationships_by_type['product_category_created'] || 0) + 1;
          }
        } else {
          result.errors.push({
            row: i,
            message: `Categoria "${categoryName}" não encontrada. Considere ativar criação automática.`,
          });
        }
      }
    } catch (error: any) {
      result.errors.push({
        row: i,
        message: `Erro ao vincular produto: ${error.message}`,
      });
    }

    updatedProducts.push(product);
  }

  return updatedProducts;
}
