import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching public form with token:', token);

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

      // Fetch opportunity data for pre-filling
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('*, account:account_id(*), contact:contact_id(*)')
        .eq('id', opportunityPublicForm.opportunity_id)
        .single();

      return new Response(
        JSON.stringify({ 
          form: {
            ...form,
            public_settings: {
              ...form.public_settings,
              logo_url: org?.logo_url || null,
            },
          },
          opportunity,
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