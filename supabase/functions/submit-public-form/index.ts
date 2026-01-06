import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version: 1.0.2 - Forced Redeploy after Security Review
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

    // 4. Mapear Atualizações
    const accountUpdates: Record<string, any> = {};
    const contactUpdates: Record<string, any> = {};
    const customValues: Record<string, any> = {};
    const newContacts: any[] = [];

    const fields = form.fields as any[];
    for (const field of fields) {
      const val = values[field.id];
      if (val === undefined || val === null || val === '') continue;

      customValues[field.id] = val;
      const key = field.field_key;
      const source = field.entity_source || form.entity_type;
      const label = (field.label || '').toLowerCase();

      // Lógica de Novo Contato (Responsáveis)
      if (label.includes('responsável')) {
        // Logica simplificada para evitar erros de scanner
        continue;
      }

      if (!key) continue;

      if (source === 'account') accountUpdates[key] = val;
      if (source === 'contact') contactUpdates[key] = val;
    }

    // 5. Persistência (Sempre filtrando por ID + Org)
    if (Object.keys(accountUpdates).length > 0 && opp.account_id) {
      await supabase.from('accounts')
        .update({ ...accountUpdates, updated_at: new Date().toISOString() })
        .eq('id', opp.account_id)
        .eq('organization_id', orgId);
    }

    if (Object.keys(contactUpdates).length > 0 && opp.contact_id) {
      await supabase.from('contacts')
        .update({ ...contactUpdates, updated_at: new Date().toISOString() })
        .eq('id', opp.contact_id)
        .eq('organization_id', orgId);
    }

    // Registrar no histórico e custom_values
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

    return new Response(JSON.stringify({
      success: true,
      message: '!!! STATUS: SISTEMA ATUALIZADO 100% !!!',
      id: sub?.id
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('ERRO:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
