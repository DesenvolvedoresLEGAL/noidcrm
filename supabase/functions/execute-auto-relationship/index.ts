import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelationshipRequest {
  entity_type: 'accounts' | 'contacts' | 'opportunities';
  data: any[];
  relationship_hints?: {
    company_cnpj_column?: string;
    contact_email_column?: string;
    account_name_column?: string;
  };
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

    const { entity_type, data, relationship_hints = {} }: RelationshipRequest = await req.json();

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
        orgMember.organization_id,
        relationship_hints,
        result
      );
    } else if (entity_type === 'opportunities') {
      result.updated_data = await linkOpportunitiesToEntities(
        supabaseClient,
        data,
        orgMember.organization_id,
        relationship_hints,
        result
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
  result: RelationshipResult
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
