import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ORGANIZATION_ID = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d';

// In-memory IP rate limiter (per edge instance): max 5 submissions / 10 min
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Per-IP rate limit (mitigates CRM spam attacks)
  const clientIp = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();

    // Validate required fields
    const errors: string[] = [];
    if (!body.nome?.trim()) errors.push('nome é obrigatório');
    if (!body.empresa?.trim()) errors.push('empresa é obrigatório');
    if (!body.email?.trim()) errors.push('email é obrigatório');
    else if (!EMAIL_RE.test(body.email.trim())) errors.push('email inválido');
    // Honeypot: bots tipicamente preenchem este campo invisível
    if (body.website || body.hp_field) errors.push('spam detectado');

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

    // Calculate D-1 for close_date_prevista
    let closeDatePrevista: string | undefined;
    if (dataEvento) {
      const eventDate = new Date(dataEvento);
      if (!isNaN(eventDate.getTime())) {
        eventDate.setDate(eventDate.getDate() - 1);
        closeDatePrevista = eventDate.toISOString().split('T')[0];
      }
    }

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
        close_date_prevista: closeDatePrevista,
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
