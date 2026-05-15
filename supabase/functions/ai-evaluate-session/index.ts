import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { callOpenAIWithGuardrails } from '../_shared/openai-client.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sanitizeUsageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
  return message.slice(0, 500);
}

async function logAIUsage(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.from('ai_usage_logs').insert(payload);
    if (error) {
      console.warn('[ai-evaluate-session] ai_usage_logs insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[ai-evaluate-session] ai_usage_logs insert exception:', sanitizeUsageErrorMessage(err));
  }
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// Input validation
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.sessionId || typeof data.sessionId !== 'string') {
    return { valid: false, error: 'Invalid session ID' };
  }
  if (!data.rubricId || typeof data.rubricId !== 'string') {
    return { valid: false, error: 'Invalid rubric ID' };
  }
  if (!Array.isArray(data.messages)) {
    return { valid: false, error: 'Invalid messages array' };
  }
  if (data.messages.length > 100) {
    return { valid: false, error: 'Too many messages (max 100)' };
  }
  return { valid: true };
}

/**
 * Robust JSON sanitizer that handles common AI response issues
 */
function sanitizeJsonString(input: string): string {
  let result = input;
  
  // Remove markdown code blocks
  result = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  // Try to extract just the JSON object
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    result = jsonMatch[0];
  }
  
  // Remove BOM and other invisible characters
  result = result.replace(/^\uFEFF/, '');
  
  // Replace problematic control characters while preserving intentional escapes
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Fix unescaped newlines inside strings (common AI issue)
  // This regex finds strings and escapes any raw newlines inside them
  result = result.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  });
  
  // Fix double-escaped sequences
  result = result.replace(/\\\\n/g, '\\n');
  result = result.replace(/\\\\r/g, '\\r');
  result = result.replace(/\\\\t/g, '\\t');
  
  // Remove trailing commas before closing brackets (common JSON error)
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  return result;
}

/**
 * Extract evaluation data using regex as fallback
 */
function extractEvaluationFallback(content: string, rubric: any): any | null {
  console.log('[ai-evaluate-session] Attempting fallback extraction...');
  
  // Try multiple patterns for overall_score
  const scorePatterns = [
    /"overall_score"\s*:\s*([\d.]+)/,
    /overall_score["\s:]+(\d+\.?\d*)/,
    /"score"\s*:\s*([\d.]+)/,
  ];
  
  let overallScore: number | null = null;
  for (const pattern of scorePatterns) {
    const match = content.match(pattern);
    if (match) {
      overallScore = parseFloat(match[1]);
      if (!isNaN(overallScore)) break;
    }
  }
  
  if (overallScore === null || isNaN(overallScore)) {
    console.error('[ai-evaluate-session] Could not extract overall_score from response');
    return null;
  }
  
  // Extract passed status
  const passedMatch = content.match(/"passed"\s*:\s*(true|false)/i);
  const passed = passedMatch 
    ? passedMatch[1].toLowerCase() === 'true' 
    : overallScore >= rubric.passing_score;
  
  // Try to extract summary
  let summary = `Nota geral: ${overallScore.toFixed(1)}/10. ${passed ? 'Aprovado' : 'Reprovado'}.`;
  
  // Multiple patterns for summary extraction
  const summaryPatterns = [
    /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
    /"summary"\s*:\s*`((?:[^`\\]|\\.)*)`/s,
  ];
  
  for (const pattern of summaryPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      summary = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      break;
    }
  }
  
  // Try to extract dimension scores
  const dimensions: any[] = [];
  const dimensionPattern = /"key"\s*:\s*"([^"]+)"[^}]*"score"\s*:\s*([\d.]+)[^}]*"feedback"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let dimensionMatch;
  
  while ((dimensionMatch = dimensionPattern.exec(content)) !== null) {
    dimensions.push({
      key: dimensionMatch[1],
      score: parseFloat(dimensionMatch[2]),
      feedback: dimensionMatch[3].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      weight: 1 / rubric.dimensions.length
    });
  }
  
  // If no dimensions extracted, create fallback from rubric
  const finalDimensions = dimensions.length > 0 
    ? dimensions 
    : rubric.dimensions.map((d: any) => ({
        key: d.name || d.key,
        score: overallScore,
        feedback: 'Avaliação detalhada não disponível (extraída via fallback).',
        weight: d.weight || (1 / rubric.dimensions.length)
      }));
  
  console.log('[ai-evaluate-session] Fallback extraction successful:', {
    overallScore,
    passed,
    dimensionsCount: finalDimensions.length,
    summaryPreview: summary.substring(0, 100)
  });
  
  return {
    dimensions: finalDimensions,
    overall_score: overallScore,
    passed,
    summary,
    _extractedViaFallback: true
  };
}

function buildContingencyEvaluation(messages: any[], rubric: any, reason: unknown): any {
  const sellerMessages = messages.filter((msg: any) => msg.sender === 'seller');
  const clientMessages = messages.filter((msg: any) => msg.sender !== 'seller');
  const sellerText = sellerMessages.map((msg: any) => String(msg.text || '')).join(' ').toLowerCase();
  const avgSellerLength = sellerMessages.length
    ? sellerMessages.reduce((sum: number, msg: any) => sum + String(msg.text || '').length, 0) / sellerMessages.length
    : 0;

  const evidenceSignals = [
    /\?/.test(sellerText),
    /(dor|problema|desafio|necessidade|objetivo|impacto|prioridade)/i.test(sellerText),
    /(valor|resultado|benefício|solução|proposta|próximo passo|agenda|reunião)/i.test(sellerText),
    sellerMessages.length >= 6,
    clientMessages.length >= 4,
    avgSellerLength >= 60,
  ].filter(Boolean).length;

  const baseScore = Math.max(4.5, Math.min(8.2, 5.2 + evidenceSignals * 0.45));
  const dims = Array.isArray(rubric.dimensions) && rubric.dimensions.length > 0
    ? rubric.dimensions
    : [{ name: 'Execução comercial', weight: 100 }];

  const dimensions = dims.map((d: any, index: number) => {
    const variation = ((index % 3) - 1) * 0.2;
    const score = Math.round(Math.max(0, Math.min(10, baseScore + variation)) * 10) / 10;
    return {
      key: d.name || d.key || `Dimensão ${index + 1}`,
      score,
      feedback: 'Avaliação de contingência gerada porque a IA principal não respondeu dentro do tempo. Revise a conversa para feedback qualitativo mais profundo.',
      weight: d.weight || (1 / dims.length),
    };
  });

  const totalWeight = dimensions.reduce((sum: number, d: any) => sum + (Number(d.weight) || 0), 0);
  const weighted = totalWeight > 0
    ? dimensions.reduce((sum: number, d: any) => sum + d.score * (Number(d.weight) || 0), 0) / totalWeight
    : baseScore;
  const overallScore = Math.round(Math.max(0, Math.min(10, weighted)) * 10) / 10;
  const reasonMessage = reason instanceof Error ? reason.message : String(reason ?? 'timeout');

  return {
    dimensions,
    overall_score: overallScore,
    passed: overallScore >= rubric.passing_score,
    summary: `Avaliação concluída em modo de contingência por instabilidade/timeout da IA principal. Nota calculada por sinais objetivos da conversa. Motivo técnico: ${sanitizeUsageErrorMessage(reasonMessage)}`,
    _contingencyFallback: true,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn('Missing authorization header; proceeding in permissive mode');
    }

    // 2. Verify user authentication with JWT from header
    console.log('[ai-evaluate-session] Verifying user authentication');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase envs', { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_KEY });
      return new Response(
        JSON.stringify({ error: 'Configuração do backend ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const globalHeaders: Record<string, string> = {};
    if (authHeader) globalHeaders['Authorization'] = authHeader;

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: globalHeaders },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError) {
      console.warn('Auth verification warning, proceeding with header token:', authError.message);
    }
    if (!user) {
      console.warn('No user resolved from token, proceeding with Authorization header presence');
    } else {
      console.log('[ai-evaluate-session] User authenticated:', user.id);
    }

    const { sessionId, rubricId, messages } = await req.json();

    // 3. Validate input
    const validation = validateInput({ sessionId, rubricId, messages });
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[ai-evaluate-session] Processing session:', sessionId, 'with', messages.length, 'messages');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch evaluation rubric
    const { data: rubric, error: rubricError } = await supabase
      .from('evaluation_rubrics')
      .select('*')
      .eq('id', rubricId)
      .single();

    if (rubricError || !rubric) {
      console.error('[ai-evaluate-session] Rubric not found:', rubricError);
      throw new Error('Rubric not found');
    }

    // Build conversation for evaluation
    const conversation = messages
      .map((msg: any) => `${msg.sender === 'seller' ? 'VENDEDOR' : 'CLIENTE'}: ${msg.text}`)
      .join('\n\n');

    // Build evaluation prompt with explicit JSON formatting instructions
    const systemPrompt = `Você é um avaliador sênior de vendas consultivas com 15+ anos de experiência em metodologias SPIN Selling, Challenger Sale e MEDDIC. Sua avaliação deve ser:

**PADRÃO DE EXCELÊNCIA:**
- Assertiva e precisa, baseada em evidências objetivas da conversa
- Profissional de alto calibre, comparável a avaliações de certificações empresariais
- Focada em comportamentos observáveis, não suposições
- Construtiva mas direta - aponte erros claramente sem rodeios

**RUBRICA DE AVALIAÇÃO:** ${rubric.name}

**DIMENSÕES DE AVALIAÇÃO (cada uma vale 0-10 pontos):**
${JSON.stringify(rubric.dimensions, null, 2)}

**CRITÉRIOS DE SCORING RIGOROSOS:**
- **9.0-10.0 (Excelente)**: Execução impecável, demonstra maestria consultiva, zero falhas críticas
- **7.0-8.9 (Bom)**: Sólido com pequenas oportunidades de melhoria, 1-2 gaps menores
- **5.0-6.9 (Satisfatório)**: Competente mas com gaps evidentes, necessita desenvolvimento
- **3.0-4.9 (Insatisfatório)**: Falhas significativas em aspectos fundamentais
- **0.0-2.9 (Crítico)**: Não demonstrou competências básicas, requer retreinamento

**NOTA DE CORTE PARA APROVAÇÃO:** ${rubric.passing_score}/10

**METODOLOGIA DE AVALIAÇÃO:**

1. **ANÁLISE POR DIMENSÃO:**
   - Identifique 2-3 momentos específicos da conversa (cite linha/fala exata)
   - Pontue com base em evidências objetivas, não impressões
   - Feedback: O QUE fez/deixou de fazer + POR QUE isso impacta + COMO melhorar

2. **FEEDBACK ASSERTIVO:**
   Use linguagem direta: "Você não fez X", "Faltou Y", "Executou Z com excelência"
   Cite exemplos textuais da conversa
   Seja específico: Não diga "melhorar rapport", diga "usar nome do cliente 3x na abertura"

3. **CÁLCULO DA NOTA:**
   - Média ponderada das dimensões
   - Arredondamento: 1 casa decimal
   - Determinação objetiva: passou >= ${rubric.passing_score}, falhou < ${rubric.passing_score}

**FORMATO DE RESPOSTA OBRIGATÓRIO:**
Retorne APENAS um objeto JSON válido, sem markdown, sem texto adicional, sem comentários.
Use aspas duplas para todas as strings.
Escape corretamente caracteres especiais dentro de strings.
NÃO use quebras de linha reais dentro de strings - use \\n para quebras de linha.`;

    const userPrompt = `Avalie esta conversa de vendas e retorne SOMENTE o JSON abaixo (nenhum texto antes ou depois):

CONVERSA:
${conversation}

FORMATO JSON EXATO (copie esta estrutura):
{"dimensions":[{"key":"nome_dimensao","score":7.5,"feedback":"Texto do feedback sem quebras de linha","weight":0.25}],"overall_score":7.2,"passed":true,"summary":"Resumo da avaliacao sem quebras de linha"}

Regras do JSON:
- Retorne APENAS o JSON, nada mais
- Use aspas duplas em todas as strings
- NÃO coloque quebras de linha dentro das strings (use texto corrido)
- overall_score deve ser um número decimal (ex: 7.5)
- passed deve ser true ou false (sem aspas)`;

    // Call AI
    console.log('[ai-evaluate-session] Calling AI for evaluation...');
    let aiResult;
    interface EvaluationResult {
      dimensions: Array<{ key: string; score: number; feedback: string; weight: number }>;
      overall_score: number;
      passed: boolean;
      summary: string;
      _extractedViaFallback?: boolean;
      _contingencyFallback?: boolean;
    }
    let evaluation: EvaluationResult | null = null;
    try {
      aiResult = await callOpenAIWithGuardrails({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000,
        timeoutMs: 60000,
        maxRetries: 2,
      });
    } catch (err) {
      await logAIUsage(supabase, {
        organization_id: rubric.organization_id ?? null,
        user_id: user?.id ?? null,
        feature: 'ai_evaluate_session',
        action: 'evaluate_session',
        entity_type: 'roleplay_session',
        entity_id: sessionId,
        model_used: 'gpt-5-nano',
        success: false,
        error_message: sanitizeUsageErrorMessage(err),
        request_metadata: {
          function_name: 'ai-evaluate-session',
          max_completion_tokens: 2500,
          retry_count: 1,
          attempts: 2,
          timed_out: false,
          response_format: 'json_object',
          contingency_fallback: true,
        },
        response_metadata: { provider: 'openai' },
      });
      console.error('[ai-evaluate-session] AI failed, using contingency evaluation:', err);
      evaluation = buildContingencyEvaluation(messages, rubric, err) as EvaluationResult;
    }

    const aiContent = aiResult?.content ?? '';

    console.log('[ai-evaluate-session] AI transport metadata:', {
      model: aiResult?.metadata.model,
      retryCount: aiResult?.metadata.retryCount,
      timedOut: aiResult?.metadata.timedOut,
      usage: aiResult?.usage ?? null,
      responseLength: aiContent.length,
      responseHash: simpleHash(aiContent),
    });
    if (aiResult) {
      await logAIUsage(supabase, {
        organization_id: rubric.organization_id ?? null,
        user_id: user?.id ?? null,
        feature: 'ai_evaluate_session',
        action: 'evaluate_session',
        entity_type: 'roleplay_session',
        entity_id: sessionId,
        model_used: aiResult.metadata.model ?? 'gpt-5-nano',
        tokens_input: aiResult.usage?.prompt_tokens ?? null,
        tokens_output: aiResult.usage?.completion_tokens ?? null,
        tokens_total: aiResult.usage?.total_tokens ?? null,
        success: true,
        latency_ms: aiResult.metadata.durationMs ?? null,
        request_metadata: {
          function_name: 'ai-evaluate-session',
          max_completion_tokens: 2500,
          retry_count: aiResult.metadata.retryCount,
          attempts: (aiResult.metadata.retryCount ?? 0) + 1,
          timed_out: aiResult.metadata.timedOut ?? false,
          response_format: 'json_object',
        },
        response_metadata: {
          provider: 'openai',
          finish_reason: (aiResult.metadata as any).finishReason ?? null,
          response_length: aiContent.length,
          response_hash: simpleHash(aiContent),
        },
      });
    }

    // Parse evaluation with robust error handling
    let parseAttempts = 0;
    const maxAttempts = 3;
    
    while (parseAttempts < maxAttempts && !evaluation) {
      parseAttempts++;
      console.log(`[ai-evaluate-session] Parse attempt ${parseAttempts}/${maxAttempts}`);
      
      try {
        // Attempt 1: Direct parse after sanitization
        const sanitized = sanitizeJsonString(aiContent);
        console.log('[ai-evaluate-session] Sanitized content metadata:', { length: sanitized.length, hash: simpleHash(sanitized) });
        evaluation = JSON.parse(sanitized) as EvaluationResult;
        console.log('[ai-evaluate-session] Direct parse successful');
      } catch (parseError) {
        console.warn(`[ai-evaluate-session] Parse attempt ${parseAttempts} failed:`, 
          parseError instanceof Error ? parseError.message : parseError);
        
        // Attempt fallback extraction
        if (parseAttempts === maxAttempts) {
          evaluation = extractEvaluationFallback(aiContent, rubric) as EvaluationResult | null;
          if (!evaluation) {
            console.error('[ai-evaluate-session] All parsing methods failed');
            throw new Error('Não foi possível processar a avaliação da IA');
          }
        }
      }
    }

    // At this point evaluation should exist
    if (!evaluation) {
      throw new Error('Avaliação não pôde ser processada');
    }

    // Validate evaluation structure
    if (!evaluation.dimensions || !Array.isArray(evaluation.dimensions)) {
      console.warn('[ai-evaluate-session] Invalid dimensions, using fallback structure');
      evaluation.dimensions = rubric.dimensions.map((d: any) => ({
        key: d.name || d.key,
        score: evaluation!.overall_score || 5,
        feedback: 'Feedback detalhado não disponível.',
        weight: d.weight || (1 / rubric.dimensions.length)
      }));
    }

    // Calculate weighted overall score if not provided or invalid
    if (!evaluation.overall_score || isNaN(evaluation.overall_score)) {
      const totalWeight = evaluation.dimensions.reduce((sum: number, d: any) => sum + (d.weight || 0), 0);
      const weightedSum = evaluation.dimensions.reduce((sum: number, d: any) => 
        sum + ((d.score || 0) * (d.weight || 0)), 0
      );
      evaluation.overall_score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    // Ensure score is within bounds
    evaluation.overall_score = Math.max(0, Math.min(10, evaluation.overall_score));
    evaluation.overall_score = Math.round(evaluation.overall_score * 10) / 10; // 1 decimal place

    // Determine pass/fail
    evaluation.passed = evaluation.overall_score >= rubric.passing_score;

    console.log('[ai-evaluate-session] Final evaluation:', {
      overall_score: evaluation.overall_score,
      passed: evaluation.passed,
      dimensionsCount: evaluation.dimensions.length,
      wasFallback: evaluation._extractedViaFallback || false
    });

    // Update session in database
    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({
        score_overall: evaluation.overall_score,
        scores_json: evaluation,
        passed: evaluation.passed,
        coach_notes: evaluation.summary ?? null,
        current_phase: 'completed',
        finished_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[ai-evaluate-session] Database update error:', updateError);
      throw updateError;
    }

    console.log('[ai-evaluate-session] Session updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        evaluation,
        session_id: sessionId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[ai-evaluate-session] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido na avaliação' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
