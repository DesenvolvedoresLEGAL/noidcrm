import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to build phone array structure (supports legacy string[] and JSONB object[])
function buildPhoneArray(value: string, existingPhones: any[] = []) {
  if (!value) return existingPhones;

  const normalized = value.replace(/\D/g, '');
  const first = (existingPhones || [])[0];

  // Legacy format: string[]
  if (!first || typeof first === 'string') {
    const cleaned = (existingPhones || [])
      .filter((p: any) => typeof p === 'string')
      .map((p: string) => p.replace(/\D/g, ''))
      .filter(Boolean)
      .filter((p: string) => p !== normalized);

    return [normalized, ...cleaned];
  }

  // JSONB format: { value, type, is_primary }[]
  const updatedPhones = (existingPhones || []).map((p: any) => ({ ...p, is_primary: false }));
  updatedPhones.unshift({ value: normalized, type: 'mobile', is_primary: true });
  return updatedPhones;
}

// Helper to build email array structure (supports legacy string[] and JSONB object[])
function buildEmailArray(value: string, existingEmails: any[] = []) {
  if (!value) return existingEmails;

  const normalized = value.toLowerCase().trim();
  const first = (existingEmails || [])[0];

  // Legacy format: string[]
  if (!first || typeof first === 'string') {
    const cleaned = (existingEmails || [])
      .filter((e: any) => typeof e === 'string')
      .map((e: string) => e.toLowerCase().trim())
      .filter(Boolean)
      .filter((e: string) => e !== normalized);

    return [normalized, ...cleaned];
  }

  // JSONB format: { value, type, is_primary }[]
  const updatedEmails = (existingEmails || []).map((e: any) => ({ ...e, is_primary: false }));
  updatedEmails.unshift({ value: normalized, type: 'work', is_primary: true });
  return updatedEmails;
}

function inferNativeMetaFromFieldId(fieldId: string): { entitySource?: 'account' | 'contact'; fieldKey?: string } {
  if (fieldId.startsWith('native-account-')) {
    return { entitySource: 'account', fieldKey: fieldId.replace('native-account-', '') };
  }
  if (fieldId.startsWith('native-contact-')) {
    return { entitySource: 'contact', fieldKey: fieldId.replace('native-contact-', '') };
  }
  return {};
}

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
    console.log('Form values received:', JSON.stringify(values, null, 2));

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
    const fields = form.fields as Array<{ 
      id: string; 
      is_required: boolean; 
      label: string; 
      field_key?: string; 
      entity_source?: string;
      type?: string;
    }>;
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

      // Fetch existing contact data for merging arrays
      let existingContact: any = null;
      if (opportunity.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('emails, telefones')
          .eq('id', opportunity.contact_id)
          .single();
        existingContact = contactData;
      }

      // Map form fields to entity columns
      const accountUpdates: Record<string, any> = {};
      const contactUpdates: Record<string, any> = {};
      
      // Track custom fields for creating new contacts (Responsável Legal/Financeiro)
      const responsavelLegal: Record<string, string> = {};
      const responsavelFinanceiro: Record<string, string> = {};
      const customFormValues: Record<string, any> = {};

      for (const field of fields) {
        const value = values[field.id];
        if (value === undefined || value === null || value === '') continue;

        const fieldId = String(field.id);
        const inferred = inferNativeMetaFromFieldId(fieldId);

        const fieldKey = field.field_key || inferred.fieldKey;
        const entitySource = (field.entity_source as any) || inferred.entitySource || form.entity_type;
        const fieldLabel = field.label?.toLowerCase() || '';

        // Store all values for custom_form_values (use the same keys the form uses)
        customFormValues[fieldId] = value;

        // Handle special cases for phone/email arrays
        if (fieldKey === 'primary_phone' || fieldKey === 'telefone_principal') {
          if (entitySource === 'contact' && opportunity.contact_id) {
            contactUpdates.telefones = buildPhoneArray(String(value), existingContact?.telefones);
          }
          continue;
        }

        if (fieldKey === 'primary_email' || fieldKey === 'email_principal') {
          if (entitySource === 'contact' && opportunity.contact_id) {
            contactUpdates.emails = buildEmailArray(String(value), existingContact?.emails);
          }
          continue;
        }

        // Handle custom fields for Responsável Legal
        if (fieldLabel.includes('responsável legal') || fieldLabel.includes('responsavel legal')) {
          if (fieldLabel.includes('nome')) {
            responsavelLegal.nome = String(value);
          } else if (fieldLabel.includes('whatsapp') || fieldLabel.includes('telefone')) {
            responsavelLegal.telefone = String(value);
          } else if (fieldLabel.includes('email') || fieldLabel.includes('e-mail')) {
            responsavelLegal.email = String(value);
          }
          continue;
        }

        // Handle custom fields for Responsável Financeiro
        if (fieldLabel.includes('responsável financeiro') || fieldLabel.includes('responsavel financeiro')) {
          if (fieldLabel.includes('nome')) {
            responsavelFinanceiro.nome = String(value);
          } else if (fieldLabel.includes('whatsapp') || fieldLabel.includes('telefone')) {
            responsavelFinanceiro.telefone = String(value);
          } else if (fieldLabel.includes('email') || fieldLabel.includes('e-mail')) {
            responsavelFinanceiro.email = String(value);
          }
          continue;
        }

        // Regular native field updates
        if (!fieldKey) continue;

        if (entitySource === 'account') {
          accountUpdates[fieldKey] = value;
        } else if (entitySource === 'contact') {
          contactUpdates[fieldKey] = value;
        }
      }

      console.log('Account updates:', JSON.stringify(accountUpdates));
      console.log('Contact updates:', JSON.stringify(contactUpdates));
      console.log('Responsável Legal:', JSON.stringify(responsavelLegal));
      console.log('Responsável Financeiro:', JSON.stringify(responsavelFinanceiro));

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

      // Create Responsável Legal contact if data provided
      if (responsavelLegal.nome && opportunity.account_id) {
        const legalContactData: any = {
          nome: responsavelLegal.nome,
          cargo: 'Responsável Legal',
          account_id: opportunity.account_id,
          organization_id: orgId,
        };

        if (responsavelLegal.telefone) {
          legalContactData.telefones = [responsavelLegal.telefone.replace(/\D/g, '')];
        }

        if (responsavelLegal.email) {
          legalContactData.emails = [responsavelLegal.email.toLowerCase().trim()];
        }

        const { data: newLegalContact, error: legalError } = await supabase
          .from('contacts')
          .insert(legalContactData)
          .select()
          .single();

        if (legalError) {
          console.error('Error creating Responsável Legal contact:', legalError);
        } else {
          console.log('Responsável Legal contact created:', newLegalContact.id);
        }
      }

      // Create Responsável Financeiro contact if data provided
      if (responsavelFinanceiro.nome && opportunity.account_id) {
        const financeContactData: any = {
          nome: responsavelFinanceiro.nome,
          cargo: 'Responsável Financeiro',
          account_id: opportunity.account_id,
          organization_id: orgId,
        };

        if (responsavelFinanceiro.telefone) {
          financeContactData.telefones = [responsavelFinanceiro.telefone.replace(/\D/g, '')];
        }

        if (responsavelFinanceiro.email) {
          financeContactData.emails = [responsavelFinanceiro.email.toLowerCase().trim()];
        }

        const { data: newFinanceContact, error: financeError } = await supabase
          .from('contacts')
          .insert(financeContactData)
          .select()
          .single();

        if (financeError) {
          console.error('Error creating Responsável Financeiro contact:', financeError);
        } else {
          console.log('Responsável Financeiro contact created:', newFinanceContact.id);
        }
      }

      // Save to custom_form_values for display in opportunity forms tab
      if (Object.keys(customFormValues).length > 0) {
        const now = new Date().toISOString();
        const { error: cfvError } = await supabase
          .from('custom_form_values')
          .upsert({
            custom_form_id: form.id,
            entity_type: 'opportunity',
            entity_id: opportunityId,
            values: customFormValues,
            organization_id: orgId,
            filled_at: now,
            filled_by: null,
            updated_at: now,
          }, {
            onConflict: 'custom_form_id,entity_type,entity_id'
          });

        if (cfvError) {
          console.error('Error saving custom_form_values:', cfvError);
        } else {
          console.log('Custom form values saved for opportunity:', opportunityId);
        }
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
