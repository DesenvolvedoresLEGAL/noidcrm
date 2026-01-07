import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version: 1.0.3 - Fixed native vs custom field handling
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers de normalização
const normalizePhone = (v: string) => v.replace(/\D/g, '');
const normalizeEmail = (v: string) => v.toLowerCase().trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, formId, organizationId: bodyOrgId, values } = await req.json();
    if (!token || !values) throw new Error('Dados incompletos');

    console.log('📥 [SUBMIT] Recebido:', { token, valuesCount: Object.keys(values).length });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Validar Token e Capturar Org segura
    const { data: opf } = await supabase
      .from('opportunity_public_forms')
      .select('form_id, opportunity_id, organization_id')
      .eq('public_token', token)
      .eq('is_enabled', true)
      .single();

    if (!opf) throw new Error('Acesso negado ou token inválido');

    const orgId = opf.organization_id;
    const oppId = opf.opportunity_id;

    // 2. Buscar Definição do Formulário (Seguro por Org)
    const { data: form } = await supabase
      .from('custom_forms')
      .select('*')
      .eq('id', opf.form_id)
      .eq('organization_id', orgId)
      .single();

    if (!form || !form.is_active) throw new Error('Formulário indisponível');

    // 3. Buscar Oportunidade e Validar Vínculo (Seguro por Org)
    const { data: opp } = await supabase
      .from('opportunities')
      .select('account_id, contact_id')
      .eq('id', oppId)
      .eq('organization_id', orgId)
      .single();

    if (!opp) throw new Error('Vínculo comercial não encontrado');

    // 4. Mapear Atualizações - CORRIGIDO: Diferenciar NATIVE vs CUSTOM
    const accountUpdates: Record<string, any> = {};
    const contactUpdates: Record<string, any> = {};
    const customValues: Record<string, any> = {};
    
    // Flags para campos especiais de contato
    let telefone_principal_value: string | null = null;
    let email_principal_value: string | null = null;

    const fields = form.fields as any[];
    console.log('📋 [SUBMIT] Processando campos:', fields.length);

    for (const field of fields) {
      const val = values[field.id];
      if (val === undefined || val === null || val === '') continue;

      // SEMPRE salvar em customValues para histórico
      customValues[field.id] = val;

      // 🔑 CORREÇÃO PRINCIPAL: Verificar source antes de atualizar tabelas
      if (field.source !== 'native') {
        console.log(`📦 [CUSTOM] Campo customizado: ${field.label} (${field.id}) = ${val}`);
        continue; // Não atualizar tabelas para campos customizados
      }

      const key = field.field_key;
      const entitySource = field.entity_source || form.entity_type;

      if (!key) continue;

      console.log(`🔧 [NATIVE] Campo nativo: ${entitySource}.${key} = ${val}`);

      if (entitySource === 'account') {
        accountUpdates[key] = val;
      }
      
      if (entitySource === 'contact') {
        // Tratar campos especiais de telefone/email (merge com arrays existentes)
        if (key === 'telefone_principal') {
          telefone_principal_value = val;
        } else if (key === 'email_principal') {
          email_principal_value = val;
        } else {
          contactUpdates[key] = val;
        }
      }
    }

    // 5. Processar telefones/emails do contato (merge com existentes)
    if ((telefone_principal_value || email_principal_value) && opp.contact_id) {
      const { data: currentContact } = await supabase
        .from('contacts')
        .select('telefones, emails')
        .eq('id', opp.contact_id)
        .single();

      if (telefone_principal_value) {
        const existingPhones = (currentContact?.telefones as any[]) || [];
        const normalizedNew = normalizePhone(telefone_principal_value);
        
        // Verificar se já existe
        const alreadyExists = existingPhones.some((p: any) => {
          const phoneVal = typeof p === 'string' ? p : p?.value || p?.numero;
          return normalizePhone(phoneVal || '') === normalizedNew;
        });

        if (!alreadyExists) {
          // Adicionar como primário no início
          contactUpdates.telefones = [
            { value: telefone_principal_value, is_primary: true },
            ...existingPhones.map((p: any) => ({ ...p, is_primary: false }))
          ];
        } else {
          // Atualizar para primário
          contactUpdates.telefones = existingPhones.map((p: any) => {
            const phoneVal = typeof p === 'string' ? p : p?.value || p?.numero;
            const isPrimary = normalizePhone(phoneVal || '') === normalizedNew;
            return typeof p === 'string' 
              ? { value: p, is_primary: isPrimary }
              : { ...p, is_primary: isPrimary };
          });
        }
        console.log('📞 [MERGE] Telefones atualizados:', contactUpdates.telefones?.length);
      }

      if (email_principal_value) {
        const existingEmails = (currentContact?.emails as any[]) || [];
        const normalizedNew = normalizeEmail(email_principal_value);
        
        const alreadyExists = existingEmails.some((e: any) => {
          const emailVal = typeof e === 'string' ? e : e?.value || e?.email;
          return normalizeEmail(emailVal || '') === normalizedNew;
        });

        if (!alreadyExists) {
          contactUpdates.emails = [
            { value: email_principal_value, is_primary: true },
            ...existingEmails.map((e: any) => ({ ...e, is_primary: false }))
          ];
        } else {
          contactUpdates.emails = existingEmails.map((e: any) => {
            const emailVal = typeof e === 'string' ? e : e?.value || e?.email;
            const isPrimary = normalizeEmail(emailVal || '') === normalizedNew;
            return typeof e === 'string' 
              ? { value: e, is_primary: isPrimary }
              : { ...e, is_primary: isPrimary };
          });
        }
        console.log('📧 [MERGE] Emails atualizados:', contactUpdates.emails?.length);
      }
    }

    // 6. Persistência (Sempre filtrando por ID + Org)
    if (Object.keys(accountUpdates).length > 0 && opp.account_id) {
      console.log('💾 [UPDATE] Account:', Object.keys(accountUpdates));
      const { error: accErr } = await supabase.from('accounts')
        .update({ ...accountUpdates, updated_at: new Date().toISOString() })
        .eq('id', opp.account_id)
        .eq('organization_id', orgId);
      
      if (accErr) console.error('❌ Erro ao atualizar account:', accErr.message);
    }

    if (Object.keys(contactUpdates).length > 0 && opp.contact_id) {
      console.log('💾 [UPDATE] Contact:', Object.keys(contactUpdates));
      const { error: ctErr } = await supabase.from('contacts')
        .update({ ...contactUpdates, updated_at: new Date().toISOString() })
        .eq('id', opp.contact_id)
        .eq('organization_id', orgId);
      
      if (ctErr) console.error('❌ Erro ao atualizar contact:', ctErr.message);
    }

    // 7. Registrar no histórico e custom_values
    console.log('💾 [UPSERT] Custom form values:', Object.keys(customValues).length);
    await supabase.from('custom_form_values').upsert({
      custom_form_id: form.id,
      entity_type: 'opportunity',
      entity_id: oppId,
      values: customValues,
      organization_id: orgId,
      filled_at: new Date().toISOString()
    }, { onConflict: 'custom_form_id,entity_type,entity_id' });

    const { data: sub } = await supabase.from('public_form_submissions').insert({
      form_id: form.id,
      organization_id: orgId,
      opportunity_id: oppId,
      values,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1'
    }).select().single();

    console.log('✅ [SUCCESS] Formulário salvo:', sub?.id);

    return new Response(JSON.stringify({
      success: true,
      message: '!!! STATUS: SISTEMA ATUALIZADO 100% !!!',
      id: sub?.id
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('❌ [ERRO]:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
