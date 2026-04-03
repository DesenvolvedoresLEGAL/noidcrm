import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ORGANIZATION_ID = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate required fields
    const errors: string[] = [];
    if (!body.nome?.trim()) errors.push('nome é obrigatório');
    if (!body.empresa?.trim()) errors.push('empresa é obrigatório');
    if (!body.email?.trim()) errors.push('email é obrigatório');

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Validação falhou', details: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nome = body.nome.trim();
    const empresa = body.empresa.trim();
    const whatsapp = body.whatsapp?.trim() || '';
    const email = body.email.trim();
    const nomeEvento = body.nome_evento?.trim() || '';
    const dataEvento = body.data_evento?.trim() || '';

    // Build notes
    const notasParts: string[] = [];
    if (nomeEvento) notasParts.push(`Evento: ${nomeEvento}`);
    if (dataEvento) notasParts.push(`Data: ${dataEvento}`);
    const notas = notasParts.length > 0 ? notasParts.join(' | ') : undefined;

    // Build title
    const titulo = nomeEvento
      ? `DIAGNÓSTICO - ${nomeEvento}`
      : `DIAGNÓSTICO - ${empresa}`;

    // Map to ingest-lead format
    const leadPayload = {
      lead: {
        razao_social: empresa,
        nome_fantasia: empresa,
        contact_nome: nome,
        contact_email: email,
        contact_telefone: whatsapp || undefined,
        titulo,
        origem: 'Landing Page - Alugue',
        notas,
      },
      organization_id: ORGANIZATION_ID,
    };

    // Call ingest-lead internally via service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/ingest-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(leadPayload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('[ingest-landing-lead] ingest-lead error:', result);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ingest-landing-lead] Lead criado com sucesso:', result.data?.opportunity_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead recebido com sucesso!',
        opportunity_id: result.data?.opportunity_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ingest-landing-lead] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
