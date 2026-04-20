import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpportunityContext {
  pipeline_name: string;
  pipeline_type: string;
  stage_name: string;
  stage_order: number;
  stage_probability: number;
  temperature: string;
  vibe_state: string;
  days_in_stage: number;
  has_proposal: boolean;
  proposal_status: string | null;
  proposal_sent_at: string | null;
  recent_activities: Array<{ type: string; status: string; date: string }>;
  recent_emails_count: number;
  last_email_sent_at: string | null;
}

function inferEmailType(ctx: OpportunityContext): string {
  const { pipeline_type, stage_order, has_proposal, proposal_status, temperature, days_in_stage, stage_probability } = ctx;

  // Operational pipelines
  if (pipeline_type === 'onboarding' || pipeline_type === 'customer_success') {
    if (stage_order <= 1) return 'onboarding_welcome';
    return 'onboarding_followup';
  }

  // Qualification pipelines
  if (pipeline_type === 'qualification') {
    if (stage_probability >= 80) return 'qualification_handoff';
    return 'qualification_discovery';
  }

  // Cold/stale leads
  if (temperature === 'cold' && days_in_stage > 14) return 'reengagement';

  // Proposal-based logic
  if (has_proposal) {
    if (proposal_status === 'approved') return 'closing';
    if (proposal_status === 'sent') return 'proposal_followup';
    if (proposal_status === 'rejected') return 'reengagement';
  }

  // High probability
  if (stage_probability >= 80) return 'closing';
  if (stage_probability >= 50) return 'negotiation';

  // Default sales
  return 'proposal_presentation';
}

function getEmailTypeLabel(emailType: string): string {
  const labels: Record<string, string> = {
    qualification_discovery: 'Descoberta / Qualificação',
    qualification_handoff: 'Passagem para Vendas',
    proposal_followup: 'Follow-up de Proposta',
    proposal_presentation: 'Apresentação de Solução',
    negotiation: 'Negociação',
    closing: 'Fechamento',
    onboarding_welcome: 'Welcome / Onboarding',
    onboarding_followup: 'Acompanhamento de Onboarding',
    reengagement: 'Reengajamento',
  };
  return labels[emailType] || emailType;
}

async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const truncated = text.slice(0, 8000);
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: truncated }),
    });
    if (!res.ok) {
      console.warn('[RAG] embedding API error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.warn('[RAG] embedding failed', e);
    return null;
  }
}

interface RagExample {
  subject: string | null;
  body_text: string;
  similarity: number;
  outcome: string | null;
}

async function fetchRagExamples(
  supabase: any,
  organizationId: string,
  emailType: string,
  ctx: OpportunityContext,
  opportunity: any,
): Promise<RagExample[]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.log('[RAG] OPENAI_API_KEY not set, skipping');
    return [];
  }

  // Build a query that captures the intent of the email being drafted
  const queryParts = [
    getEmailTypeLabel(emailType),
    ctx.stage_name,
    opportunity.title,
    opportunity.account?.razao_social || opportunity.account?.nome_fantasia || '',
    opportunity.account?.segmento || '',
    ctx.has_proposal ? `proposta ${ctx.proposal_status}` : '',
  ].filter(Boolean).join(' | ');

  const embedding = await generateQueryEmbedding(queryParts, openaiKey);
  if (!embedding) return [];

  // Prefer high-quality examples (won deals get 0.85, neutral 0.5)
  const { data, error } = await supabase.rpc('match_email_knowledge', {
    query_embedding: embedding,
    p_organization_id: organizationId,
    match_threshold: 0.5,
    match_count: 3,
    filter_pipeline_stage: null,
    filter_outcome: null,
    min_quality: 0.4,
  });

  if (error) {
    console.warn('[RAG] match_email_knowledge error', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    subject: m.subject,
    body_text: (m.body_text || '').slice(0, 800),
    similarity: m.similarity,
    outcome: m.metadata?.opportunity_outcome || null,
  }));
}

function buildContextualPrompt(ctx: OpportunityContext, emailType: string, opportunity: any, userContext: string, previousEmail: string, ragExamples: RagExample[] = []): string {
  const typeLabel = getEmailTypeLabel(emailType);

  const scenarioRules: Record<string, string> = {
    qualification_discovery: `CENÁRIO: Lead em qualificação, etapas iniciais.
OBJETIVO: Entender a dor do prospect, fazer perguntas de discovery, agendar reunião de qualificação.
TOM: Casual, curioso, sem pressão de venda. Faça perguntas abertas.
NÃO FAZER: Não mencionar preço, não enviar proposta, não assumir que já há interesse confirmado.`,
    qualification_handoff: `CENÁRIO: Lead qualificado, pronto para avançar para vendas.
OBJETIVO: Confirmar interesse, agendar reunião com o time de vendas, fazer a transição.
TOM: Casual e direto. Destaque os próximos passos.`,
    proposal_presentation: `CENÁRIO: Oportunidade de vendas SEM proposta enviada.
OBJETIVO: Apresentar valor da solução, despertar interesse em receber uma proposta.
TOM: Descontraído, focado em benefícios e ROI. Inclua CTA para agendar apresentação.
NÃO FAZER: Não enviar valores sem proposta formal.`,
    proposal_followup: `CENÁRIO: Proposta JÁ ENVIADA, aguardando resposta.
OBJETIVO: Follow-up da proposta, esclarecer dúvidas, avançar para negociação.
TOM: Amigável e direto. Pergunte se houve dúvidas sobre a proposta.
IMPORTANTE: Referencie a proposta enviada em ${ctx.proposal_sent_at || 'data recente'}.`,
    negotiation: `CENÁRIO: Negociação em andamento, probabilidade média-alta.
OBJETIVO: Resolver objeções, negociar termos, avançar para fechamento.
TOM: Direto, flexível, focado em encontrar o melhor acordo.`,
    closing: `CENÁRIO: Alta probabilidade de fechamento (${ctx.stage_probability}%).
OBJETIVO: Fechar o negócio, definir próximos passos do contrato/implantação.
TOM: Direto e objetivo. CTA claro para assinatura ou confirmação.`,
    onboarding_welcome: `CENÁRIO: Cliente novo em onboarding.
OBJETIVO: Dar boas-vindas, apresentar o time de suporte, definir cronograma.
TOM: Acolhedor e descontraído, focado em sucesso do cliente.
NÃO FAZER: NÃO vender. O foco é serviço e acompanhamento.`,
    onboarding_followup: `CENÁRIO: Cliente em processo de onboarding/operacional.
OBJETIVO: Acompanhar progresso, verificar satisfação, resolver pendências.
TOM: Casual e proativo, orientado a serviço.`,
    reengagement: `CENÁRIO: Lead frio ou parado há ${ctx.days_in_stage} dias na etapa.
OBJETIVO: Reengajar de forma suave, oferecer novo valor, reabrir conversa.
TOM: Leve, descontraído, sem pressão. Ofereça algo novo (insight, caso de sucesso, novidade).
NÃO FAZER: Não ser agressivo, não reclamar da falta de resposta.`,
  };

  const rules = scenarioRules[emailType] || scenarioRules.proposal_presentation;

  const activitySummary = ctx.recent_activities.length > 0
    ? ctx.recent_activities.map(a => `- ${a.type} (${a.status}) em ${a.date}`).join('\n')
    : 'Nenhuma atividade recente';

  const ragSection = ragExamples.length > 0
    ? `\nEXEMPLOS DA SUA PRÓPRIA BASE (use como referência de tom, estrutura e estilo — NÃO copie literalmente):\n${ragExamples.map((ex, i) => `\n[Exemplo ${i + 1}${ex.outcome === 'won' ? ' - DEAL GANHO' : ''} | similaridade ${ex.similarity.toFixed(2)}]\nAssunto: ${ex.subject || '(sem assunto)'}\nCorpo: ${ex.body_text}`).join('\n')}\n\nUse esses exemplos para calibrar tom, vocabulário e abordagem que historicamente funcionam para esta organização. Mantenha a personalização do contexto atual.\n`
    : '';

  return `Gere um email de vendas B2B com tom INFORMAL e DESCONTRAÍDO para esta oportunidade.

TIPO DE E-MAIL INFERIDO: ${typeLabel}

${rules}

CONTEXTO DA OPORTUNIDADE:
- Pipeline: ${ctx.pipeline_name} (${ctx.pipeline_type})
- Etapa atual: ${ctx.stage_name} (posição ${ctx.stage_order + 1}, probabilidade ${ctx.stage_probability}%)
- Temperatura: ${ctx.temperature || 'não definida'}
- Estado: ${ctx.vibe_state || 'não definido'}
- Dias na etapa: ${ctx.days_in_stage}
- Proposta: ${ctx.has_proposal ? `Sim (status: ${ctx.proposal_status})` : 'Não enviada'}
- Emails enviados: ${ctx.recent_emails_count} ${ctx.last_email_sent_at ? `(último em ${ctx.last_email_sent_at})` : ''}

ATIVIDADES RECENTES:
${activitySummary}

DADOS DA OPORTUNIDADE:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Status: ${opportunity.status}

DESTINATÁRIO:
- Nome: ${opportunity.contact?.primeiro_nome || opportunity.contact?.nome || 'Cliente'}
- Cargo: ${opportunity.contact?.cargo || ''}
- Empresa: ${opportunity.account?.razao_social || opportunity.account?.nome_fantasia || ''}

${previousEmail ? `EMAIL ANTERIOR DO CLIENTE:\n${previousEmail}\n` : ''}
${userContext ? `CONTEXTO ADICIONAL DO VENDEDOR: ${userContext}\n` : ''}
${ragSection}

REGRAS GERAIS:
- Use tom INFORMAL e amigável. Cumprimente com "Oi [Nome]", "[Nome], tudo bem?", "E aí [Nome]!"
- NUNCA use "Prezado(a)", "Caro(a)", "Vossa Senhoria" ou saudações formais
- Escreva como se fosse uma conversa entre colegas de negócio
- Seja conciso e direto (máximo 200 palavras no corpo)
- Inclua um CTA claro e específico
- Personalize com informações reais do contexto
- Use HTML simples para formatação (p, strong, ul, li)
- NÃO invente informações que não estão no contexto

Retorne EXATAMENTE neste formato JSON:
{
  "subject": "<assunto do email>",
  "body": "<corpo do email em HTML formatado>",
  "tone": "<professional|friendly|formal>",
  "cta": "<call to action principal>",
  "emailType": "${emailType}",
  "emailTypeLabel": "${typeLabel}",
  "alternatives": [
    {
      "subject": "<assunto alternativo>",
      "body": "<corpo alternativo>"
    }
  ]
}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, context, emailType: requestedType, previousEmail } = await req.json();

    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch opportunity with relations
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Fetch pipeline and stage info
    let pipelineData = { name: 'Desconhecido', pipeline_type: 'sales' };
    let stageData = { name: 'Desconhecido', order_index: 0, probability: 50 };

    if (opportunity.pipeline_id) {
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('name, pipeline_type')
        .eq('id', opportunity.pipeline_id)
        .single();
      if (pipeline) pipelineData = pipeline;
    }

    if (opportunity.stage_id) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('name, order_index, probability')
        .eq('id', opportunity.stage_id)
        .single();
      if (stage) stageData = stage;
    }

    // Fetch proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select('status, sent_at, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestProposal = proposals?.[0] || null;

    // Fetch recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('type, status, scheduled_date')
      .eq('opportunity_id', opportunityId)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false })
      .limit(10);

    // Fetch recent emails
    const { data: emails } = await supabase
      .from('opportunity_emails')
      .select('sent_at')
      .eq('opportunity_id', opportunityId)
      .order('sent_at', { ascending: false })
      .limit(10);

    // Calculate days in stage
    const stageChangedAt = opportunity.stage_changed_at || opportunity.created_at;
    const daysInStage = Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24));

    // Build context
    const oppContext: OpportunityContext = {
      pipeline_name: pipelineData.name,
      pipeline_type: pipelineData.pipeline_type || 'sales',
      stage_name: stageData.name,
      stage_order: stageData.order_index,
      stage_probability: stageData.probability || 50,
      temperature: opportunity.temperature || '',
      vibe_state: opportunity.vibe_state || '',
      days_in_stage: daysInStage,
      has_proposal: !!latestProposal,
      proposal_status: latestProposal?.status || null,
      proposal_sent_at: latestProposal?.sent_at || null,
      recent_activities: (activities || []).map(a => ({
        type: a.type,
        status: a.status || 'pending',
        date: a.scheduled_date || '',
      })),
      recent_emails_count: emails?.length || 0,
      last_email_sent_at: emails?.[0]?.sent_at || null,
    };

    // Infer email type
    const emailType = requestedType || inferEmailType(oppContext);

    // GUARDRAILS
    const warnings: string[] = [];

    // Check contact email
    const contactEmail = opportunity.contact?.email || (opportunity.contact?.emails && opportunity.contact.emails[0]);
    if (!contactEmail) {
      warnings.push('O contato desta oportunidade não possui e-mail cadastrado.');
    }

    // Check recent email (last 24h)
    if (oppContext.last_email_sent_at) {
      const hoursSinceLastEmail = (Date.now() - new Date(oppContext.last_email_sent_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastEmail < 24) {
        warnings.push(`Um e-mail foi enviado há ${Math.round(hoursSinceLastEmail)} horas. Considere aguardar antes de enviar outro.`);
      }
    }

    // Check incompatible type
    if ((emailType === 'proposal_followup' || emailType === 'closing') && !oppContext.has_proposal) {
      warnings.push('Não há proposta enviada para esta oportunidade. O tipo de e-mail foi ajustado.');
    }

    // Generate with AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const emailContext = previousEmail ? previousEmail : '';
    const userContext = context || '';
    const prompt = buildContextualPrompt(oppContext, emailType, opportunity, userContext, emailContext);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em copywriting de vendas B2B. Escreva emails curtos, diretos e com tom INFORMAL/DESCONTRAÍDO. Use cumprimentos como "Oi [Nome]", "[Nome], tudo bem?", "E aí [Nome]!". NUNCA use "Prezado(a)", "Caro(a)" ou linguagem excessivamente formal. Escreva como se fosse uma conversa entre colegas de negócio. SEMPRE retorne JSON válido no formato solicitado.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    // Enrich response with context metadata
    const enrichedResponse = {
      ...aiResponse,
      emailType,
      emailTypeLabel: getEmailTypeLabel(emailType),
      context: {
        pipeline_name: oppContext.pipeline_name,
        pipeline_type: oppContext.pipeline_type,
        stage_name: oppContext.stage_name,
        stage_probability: oppContext.stage_probability,
        temperature: oppContext.temperature,
        days_in_stage: oppContext.days_in_stage,
        has_proposal: oppContext.has_proposal,
        proposal_status: oppContext.proposal_status,
        recent_emails_count: oppContext.recent_emails_count,
      },
      warnings,
    };

    console.log('AI Email generated:', enrichedResponse.emailType, enrichedResponse.emailTypeLabel);

    return new Response(JSON.stringify(enrichedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-email-assist:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
