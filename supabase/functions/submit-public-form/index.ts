import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to build phone array structure
function buildPhoneArray(value: string, existingPhones: any[] = []) {
  if (!value) return existingPhones;
  const normalized = value.replace(/\D/g, '');
  const first = (existingPhones || [])[0];
  if (!first || typeof first === 'string') {
    const cleaned = (existingPhones || [])
      .filter((p: any) => typeof p === 'string')
      .map((p: string) => p.replace(/\D/g, ''))
      .filter(Boolean)
      .filter((p: string) => p !== normalized);
    return [normalized, ...cleaned];
  }
  const updatedPhones = (existingPhones || []).map((p: any) => ({ ...p, is_primary: false }));
  updatedPhones.unshift({ value: normalized, type: 'mobile', is_primary: true });
  return updatedPhones;
}

// Helper to build email array structure
function buildEmailArray(value: string, existingEmails: any[] = []) {
  if (!value) return existingEmails;
  const normalized = value.toLowerCase().trim();
  const first = (existingEmails || [])[0];
  if (!first || typeof first === 'string') {
    const cleaned = (existingEmails || [])
      .filter((e: any) => typeof e === 'string')
      .map((e: string) => e.toLowerCase().trim())
      .filter(Boolean)
      .filter((e: string) => e !== normalized);
    return [normalized, ...cleaned];
  }
  const updatedEmails = (existingEmails || []).map((e: any) => ({ ...e, is_primary: false }));
  updatedEmails.unshift({ value: normalized, type: 'work', is_primary: true });
  return updatedEmails;
}

function inferNativeMetaFromFieldId(fieldId: string): { entitySource?: 'account' | 'contact'; fieldKey?: string } {
  if (fieldId.startsWith('native-account-')) return { entitySource: 'account', fieldKey: fieldId.replace('native-account-', '') };
  if (fieldId.startsWith('native-contact-')) return { entitySource: 'contact', fieldKey: fieldId.replace('native-contact-', '') };
  return {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, formId, organizationId, values } = await req.json();
    if (!token || !values) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let form: any = null;
    let opportunityId: string | null = null;
    let orgId: string = organizationId;
    let accountUpdates: Record<string, any> = {};
    let contactUpdates: Record<string, any> = {};

    // 1. Find Token/Form
    const { data: opf } = await supabase
      .from('opportunity_public_forms')
      .select('id, form_id, opportunity_id, organization_id, is_enabled')
      .eq('public_token', token)
      .eq('is_enabled', true)
      .single();

    if (opf) {
      opportunityId = opf.opportunity_id;
      orgId = opf.organization_id;
      const { data: formData } = await supabase.from('custom_forms').select('id, name, entity_type, fields, is_active').eq('id', opf.form_id).single();
      form = formData;
    } else {
      const { data: legacyForm } = await supabase.from('custom_forms').select('id, name, entity_type, fields, is_public, is_active').eq('id', formId).eq('public_token', token).single();
      form = legacyForm;
    }

    if (!form) return new Response(JSON.stringify({ error: 'Formulário não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 2. Validate
    const fields = form.fields as any[];
    const missingFields = fields.filter(f => f.is_required && !values[f.id]).map(f => f.label);
    if (missingFields.length > 0) return new Response(JSON.stringify({ error: `Campos obrigatórios: ${missingFields.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 3. Process Updates
    if (opportunityId) {
      const { data: opportunity } = await supabase.from('opportunities').select('account_id, contact_id').eq('id', opportunityId).single();
      if (opportunity) {
        let existingContact: any = null;
        if (opportunity.contact_id) {
          const { data: cData } = await supabase.from('contacts').select('emails, telefones').eq('id', opportunity.contact_id).single();
          existingContact = cData;
        }

        const responsavelLegal: Record<string, string> = {};
        const responsavelFinanceiro: Record<string, string> = {};
        const customFormValues: Record<string, any> = {};

        for (const field of fields) {
          const value = values[field.id];
          if (value === undefined || value === null || value === '') continue;

          const fieldId = String(field.id);
          const inferred = inferNativeMetaFromFieldId(fieldId);
          const fieldKey = field.field_key || inferred.fieldKey;
          const entitySource = field.entity_source || inferred.entitySource || form.entity_type;
          const label = field.label?.toLowerCase() || '';

          customFormValues[fieldId] = value;

          if (fieldKey === 'primary_phone' || fieldKey === 'telefone_principal') {
            if (entitySource === 'contact' && opportunity.contact_id) contactUpdates.telefones = buildPhoneArray(String(value), existingContact?.telefones);
            continue;
          }
          if (fieldKey === 'primary_email' || fieldKey === 'email_principal') {
            if (entitySource === 'contact' && opportunity.contact_id) contactUpdates.emails = buildEmailArray(String(value), existingContact?.emails);
            continue;
          }

          if (label.includes('responsável legal')) {
            if (label.includes('nome')) responsavelLegal.nome = String(value);
            else if (label.includes('whatsapp') || label.includes('telefone')) responsavelLegal.telefone = String(value);
            else if (label.includes('email')) responsavelLegal.email = String(value);
            continue;
          }
          if (label.includes('responsável financeiro')) {
            if (label.includes('nome')) responsavelFinanceiro.nome = String(value);
            else if (label.includes('whatsapp') || label.includes('telefone')) responsavelFinanceiro.telefone = String(value);
            else if (label.includes('email')) responsavelFinanceiro.email = String(value);
            continue;
          }

          if (!fieldKey) continue;
          if (entitySource === 'account') accountUpdates[fieldKey] = value;
          else if (entitySource === 'contact') contactUpdates[fieldKey] = value;
        }

        if (Object.keys(accountUpdates).length > 0 && opportunity.account_id) {
          await supabase.from('accounts').update({ ...accountUpdates, updated_at: new Date().toISOString() }).eq('id', opportunity.account_id);
        }
        if (Object.keys(contactUpdates).length > 0 && opportunity.contact_id) {
          await supabase.from('contacts').update({ ...contactUpdates, updated_at: new Date().toISOString() }).eq('id', opportunity.contact_id);
        }

        // Novos Contatos
        if (responsavelLegal.nome && opportunity.account_id) {
          await supabase.from('contacts').insert({ nome: responsavelLegal.nome, cargo: 'Responsável Legal', account_id: opportunity.account_id, organization_id: orgId, telefones: responsavelLegal.telefone ? [responsavelLegal.telefone.replace(/\D/g, '')] : [], emails: responsavelLegal.email ? [responsavelLegal.email.toLowerCase().trim()] : [] });
        }
        if (responsavelFinanceiro.nome && opportunity.account_id) {
          await supabase.from('contacts').insert({ nome: responsavelFinanceiro.nome, cargo: 'Responsável Financeiro', account_id: opportunity.account_id, organization_id: orgId, telefones: responsavelFinanceiro.telefone ? [responsavelFinanceiro.telefone.replace(/\D/g, '')] : [], emails: responsavelFinanceiro.email ? [responsavelFinanceiro.email.toLowerCase().trim()] : [] });
        }

        if (Object.keys(customFormValues).length > 0) {
          await supabase.from('custom_form_values').upsert({ custom_form_id: form.id, entity_type: 'opportunity', entity_id: opportunityId, values: customFormValues, organization_id: orgId, filled_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'custom_form_id,entity_type,entity_id' });
        }
      }
    }

    // 4. History
    const { data: submission } = await supabase.from('public_form_submissions').insert({ form_id: form.id, organization_id: orgId, opportunity_id: opportunityId, values, ip_address: req.headers.get('x-forwarded-for') || 'unknown', user_agent: req.headers.get('user-agent') || 'unknown' }).select().single();

    return new Response(JSON.stringify({
      success: true,
      submissionId: submission?.id,
      message: 'Dados atualizados!',
      debug: {
        account_fields: Object.keys(accountUpdates),
        contact_fields: Object.keys(contactUpdates),
        opportunityId
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
