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
    const { token, formId, organizationId, values } = await req.json();

    if (!token || !values) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Submitting public form with token:', token.substring(0, 8) + '...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let form: any = null;
    let opportunityId: string | null = null;
    let orgId: string = organizationId;

    // First: check if it's an opportunity-based public form token
    const { data: opf, error: opfError } = await supabase
      .from('opportunity_public_forms')
      .select('id, form_id, opportunity_id, organization_id, is_enabled')
      .eq('public_token', token)
      .eq('is_enabled', true)
      .single();

    if (opf) {
      console.log('Found opportunity public form:', opf.id);
      opportunityId = opf.opportunity_id;
      orgId = opf.organization_id;

      // Fetch the form details
      const { data: formData, error: formError } = await supabase
        .from('custom_forms')
        .select('id, name, entity_type, fields, is_active')
        .eq('id', opf.form_id)
        .eq('is_active', true)
        .single();

      if (formError || !formData) {
        console.error('Form not found for opportunity public form:', formError);
        return new Response(
          JSON.stringify({ error: 'Formulário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      form = formData;
    } else {
      // Fallback: check for direct form public token (legacy)
      console.log('Checking legacy public token...');
      
      if (!formId) {
        return new Response(
          JSON.stringify({ error: 'Form ID is required for legacy tokens' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: legacyForm, error: legacyError } = await supabase
        .from('custom_forms')
        .select('id, name, entity_type, fields, is_public, is_active')
        .eq('id', formId)
        .eq('public_token', token)
        .single();

      if (legacyError || !legacyForm) {
        console.error('Form not found with legacy token:', legacyError);
        return new Response(
          JSON.stringify({ error: 'Formulário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!legacyForm.is_public || !legacyForm.is_active) {
        return new Response(
          JSON.stringify({ error: 'Formulário não está disponível' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      form = legacyForm;
    }

    // Validate required fields
    const fields = form.fields as Array<{ id: string; is_required: boolean; label: string; field_key?: string; entity_source?: string }>;
    const missingFields = fields
      .filter(f => f.is_required && !values[f.id])
      .map(f => f.label);

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Campos obrigatórios: ${missingFields.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get IP and user agent for logging
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('cf-connecting-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // If this is an account/contact form (Ficha Cadastral), update the entities directly
    if (opportunityId && (form.entity_type === 'account' || form.entity_type === 'contact')) {
      console.log('Updating account/contact data from form submission...');

      // Fetch the opportunity to get account_id and contact_id
      const { data: opportunity, error: oppError } = await supabase
        .from('opportunities')
        .select('account_id, contact_id')
        .eq('id', opportunityId)
        .single();

      if (oppError || !opportunity) {
        console.error('Opportunity not found:', oppError);
        return new Response(
          JSON.stringify({ error: 'Oportunidade não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map form fields to entity columns
      const accountUpdates: Record<string, any> = {};
      const contactUpdates: Record<string, any> = {};

      for (const field of fields) {
        const value = values[field.id];
        if (value === undefined || value === null || value === '') continue;
        
        const fieldKey = field.field_key;
        if (!fieldKey) continue;

        const entitySource = field.entity_source || form.entity_type;

        if (entitySource === 'account') {
          accountUpdates[fieldKey] = value;
        } else if (entitySource === 'contact') {
          contactUpdates[fieldKey] = value;
        }
      }

      console.log('Account updates:', Object.keys(accountUpdates));
      console.log('Contact updates:', Object.keys(contactUpdates));

      // Update account if there are changes
      if (Object.keys(accountUpdates).length > 0 && opportunity.account_id) {
        accountUpdates.updated_at = new Date().toISOString();
        const { error: accountError } = await supabase
          .from('accounts')
          .update(accountUpdates)
          .eq('id', opportunity.account_id);

        if (accountError) {
          console.error('Error updating account:', accountError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar dados da conta' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Account updated successfully:', opportunity.account_id);
      }

      // Update contact if there are changes
      if (Object.keys(contactUpdates).length > 0 && opportunity.contact_id) {
        contactUpdates.updated_at = new Date().toISOString();
        const { error: contactError } = await supabase
          .from('contacts')
          .update(contactUpdates)
          .eq('id', opportunity.contact_id);

        if (contactError) {
          console.error('Error updating contact:', contactError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar dados do contato' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Contact updated successfully:', opportunity.contact_id);
      }
    }

    // Save submission history
    const { data: submission, error: submitError } = await supabase
      .from('public_form_submissions')
      .insert({
        form_id: form.id,
        organization_id: orgId,
        opportunity_id: opportunityId,
        values,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (submitError) {
      console.error('Error saving submission:', submitError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar formulário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Submission saved:', submission.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        submissionId: submission.id,
        message: 'Dados atualizados com sucesso!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error submitting form:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
