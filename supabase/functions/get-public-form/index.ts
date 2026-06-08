import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract primary email from emails array (supports legacy string[] and JSONB object[])
function extractPrimaryEmail(emails: any[] | null): string | undefined {
  if (!emails || !Array.isArray(emails) || emails.length === 0) return undefined;
  if (typeof emails[0] === 'string') return String(emails[0]);
  const primary = emails.find((e: any) => e?.is_primary);
  return primary?.value || emails[0]?.value;
}

// Helper to extract primary phone from telefones array (supports legacy string[] and JSONB object[])
function extractPrimaryPhone(telefones: any[] | null): string | undefined {
  if (!telefones || !Array.isArray(telefones) || telefones.length === 0) return undefined;
  if (typeof telefones[0] === 'string') return String(telefones[0]);
  const primary = telefones.find((t: any) => t?.is_primary);
  return primary?.value || telefones[0]?.value;
}

serve(async (req) => {
  console.log('get-public-form: Request received', { method: req.method, url: req.url });
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('get-public-form: Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token } = body;
    
    console.log('get-public-form: Request body received', { token: token ? `${token.substring(0, 8)}...` : 'missing' });

    if (!token) {
      console.error('get-public-form: Token is missing');
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('get-public-form: Fetching public form with token:', token);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First check if it's an opportunity-based public form token
    const { data: opportunityPublicForm, error: opfError } = await supabase
      .from('opportunity_public_forms')
      .select(`
        id,
        opportunity_id,
        form_id,
        organization_id,
        is_enabled
      `)
      .eq('public_token', token)
      .eq('is_enabled', true)
      .single();

    if (opportunityPublicForm) {
      console.log('Found opportunity public form:', opportunityPublicForm.id);

      // Fetch the form details
      const { data: form, error: formError } = await supabase
        .from('custom_forms')
        .select('id, name, description, entity_type, fields, organization_id, public_settings')
        .eq('id', opportunityPublicForm.form_id)
        .eq('is_active', true)
        .single();

      if (formError || !form) {
        console.error('Form not found:', formError);
        return new Response(
          JSON.stringify({ error: 'Formulário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch organization logo
      const { data: org } = await supabase
        .from('organizations')
        .select('logo_url, name')
        .eq('id', opportunityPublicForm.organization_id)
        .single();

      // Fetch opportunity data for pre-filling — SAFE FIELDS ONLY.
      // Never expose CPF/CNPJ/RG/score_financeiro/risco_financeiro/etc.
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          pipeline_id,
          stage_id,
          status,
          account:account_id(id, razao_social, nome_fantasia, cidade, uf, tipo_pessoa),
          contact:contact_id(id, nome, cargo, emails, telefones)
        `)
        .eq('id', opportunityPublicForm.opportunity_id)
        .single();

      // Extract primary email and phone from contact arrays for pre-filling,
      // then drop the raw arrays so we never leak secondary contacts.
      let enrichedOpportunity: any = opportunity;
      if (opportunity?.contact) {
        const contact = opportunity.contact as any;
        const primary_email = extractPrimaryEmail(contact.emails);
        const primary_phone = extractPrimaryPhone(contact.telefones);
        enrichedOpportunity = {
          ...opportunity,
          contact: {
            id: contact.id,
            nome: contact.nome,
            cargo: contact.cargo,
            primary_email,
            primary_phone,
          },
        };
      }

      return new Response(
        JSON.stringify({ 
          form: {
            ...form,
            public_settings: {
              ...form.public_settings,
              logo_url: org?.logo_url || null,
            },
          },
          opportunity: enrichedOpportunity,
          organization: org,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: check for direct form public token (legacy)
    const { data: form, error } = await supabase
      .from('custom_forms')
      .select('id, name, description, entity_type, fields, organization_id, public_settings')
      .eq('public_token', token)
      .eq('is_public', true)
      .eq('is_active', true)
      .single();

    if (error || !form) {
      console.error('Form not found:', error);
      return new Response(
        JSON.stringify({ error: 'Formulário não encontrado ou não está público' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch organization logo
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url, name')
      .eq('id', form.organization_id)
      .single();

    console.log('Form found:', form.id);

    return new Response(
      JSON.stringify({ 
        form: {
          ...form,
          public_settings: {
            ...form.public_settings,
            logo_url: org?.logo_url || null,
          },
        },
        organization: org,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error fetching public form:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
