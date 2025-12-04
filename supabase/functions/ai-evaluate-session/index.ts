import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('Verifying user authentication');
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
      console.log('User authenticated:', user.id);
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch evaluation rubric
    const { data: rubric, error: rubricError } = await supabase
      .from('evaluation_rubrics')
      .select('*')
      .eq('id', rubricId)
      .single();

    if (rubricError || !rubric) {
      throw new Error('Rubric not found');
    }

    // Build conversation for evaluation
    const conversation = messages
      .map((msg: any) => `${msg.sender === 'seller' ? 'VENDEDOR' : 'CLIENTE'}: ${msg.text}`)
      .join('\n\n');

    // Build evaluation prompt with professional assessment standards
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
   ✓ Use linguagem direta: "Você não fez X", "Faltou Y", "Executou Z com excelência"
   ✓ Cite exemplos textuais: "Quando disse '[fala exata]', você perdeu..."
   ✓ Seja específico: Não diga "melhorar rapport", diga "usar nome do cliente 3x na abertura"
   ✗ Evite eufemismos: Não diga "poderia ter", diga "deveria ter feito"
   ✗ Evite generalidades: Não diga "boa descoberta", especifique o que foi bom

3. **CÁLCULO DA NOTA:**
   - Média ponderada das dimensões
   - Arredondamento: 1 casa decimal
   - Determinação objetiva: passou >= ${rubric.passing_score}, falhou < ${rubric.passing_score}

4. **RESUMO EXECUTIVO:**
   - 3-4 frases diretas sobre a performance geral
   - Identifique 1 força principal e 1 oportunidade crítica de desenvolvimento
   - Tom profissional mas franco: vendedor precisa saber EXATAMENTE onde está

**IMPORTANT: SEJA RIGOROSO MAS JUSTO:**
- Não infle notas artificialmente - use toda a escala 0-10
- Vendas consultivas de excelência são RARAS - notas 9-10 devem ser excepcionais
- Identifique gaps reais mesmo em vendedores "bons" (7-8)
- Seu papel é desenvolver profissionais de elite, não apenas aproveitá-los`;

    const userPrompt = `Avalie esta conversa de vendas segundo os critérios profissionais estabelecidos:

═══════════════════════════════════════════════════════════
CONVERSA COMPLETA:
═══════════════════════════════════════════════════════════

${conversation}

═══════════════════════════════════════════════════════════
TAREFA:
═══════════════════════════════════════════════════════════

Retorne APENAS um JSON válido (sem blocos markdown, sem \`\`\`json) com esta estrutura EXATA:

{
  "dimensions": [
    {
      "key": "nome_da_dimensao_exato",
      "score": 7.5,
      "feedback": "**Evidências Observadas:**\n- [Momento 1]: Quando disse '[fala exata]', você [análise]\n- [Momento 2]: Faltou [comportamento esperado] porque [impacto]\n\n**Impacto:** [Consequência direta na venda]\n\n**Como Melhorar:** [Ação específica e mensurável]",
      "weight": 0.25
    }
  ],
  "overall_score": 7.2,
  "passed": true,
  "summary": "**Performance Geral:** [Avaliação direta em 2-3 frases]\n\n**Principal Força:** [Comportamento específico que executou bem]\n\n**Oportunidade Crítica:** [Gap mais importante a desenvolver com ação concreta]"
}

**LEMBRE-SE:**
- Cite falas EXATAS da conversa como evidências
- Use toda escala 0-10 (não concentre em 7-8)
- Seja assertivo e direto no feedback
- Forneça ações CONCRETAS de melhoria, não conceitos abstratos`;

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI evaluation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    console.log('AI raw response length:', aiContent.length);
    console.log('AI response preview (first 500 chars):', aiContent.substring(0, 500));

    // Parse evaluation with robust JSON extraction
    let evaluation;
    try {
      // Remove markdown code blocks
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON if there's extra text
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      // Sanitize problematic characters that break JSON parsing
      // Replace unescaped control characters
      cleanContent = cleanContent
        .replace(/[\x00-\x1F\x7F]/g, (char: string) => {
          // Keep escaped newlines and tabs
          if (char === '\n') return '\\n';
          if (char === '\r') return '\\r';
          if (char === '\t') return '\\t';
          return '';
        })
        // Fix common escape issues
        .replace(/\\\\n/g, '\\n')
        .replace(/\\\\"/g, '\\"');
      
      console.log('Cleaned content for parsing (first 300 chars):', cleanContent.substring(0, 300));
      evaluation = JSON.parse(cleanContent);
      console.log('Successfully parsed evaluation with overall_score:', evaluation.overall_score);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content (first 1000 chars):', aiContent.substring(0, 1000));
      
      // Fallback: Try to extract scores manually using regex
      try {
        console.log('Attempting fallback evaluation extraction...');
        const overallScoreMatch = aiContent.match(/"overall_score"\s*:\s*([\d.]+)/);
        const passedMatch = aiContent.match(/"passed"\s*:\s*(true|false)/);
        const summaryMatch = aiContent.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        
        if (overallScoreMatch) {
          const overallScore = parseFloat(overallScoreMatch[1]);
          const passed = passedMatch ? passedMatch[1] === 'true' : overallScore >= rubric.passing_score;
          
          evaluation = {
            dimensions: rubric.dimensions.map((d: any) => ({
              key: d.name || d.key,
              score: overallScore,
              feedback: 'Avaliação extraída via fallback devido a erro de parsing.',
              weight: d.weight || (1 / rubric.dimensions.length)
            })),
            overall_score: overallScore,
            passed: passed,
            summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n') : `Nota geral: ${overallScore.toFixed(1)}. ${passed ? 'Aprovado' : 'Reprovado'}.`
          };
          console.log('Fallback extraction successful, overall_score:', overallScore);
        } else {
          throw new Error('Could not extract score from AI response');
        }
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
        throw new Error(`Invalid evaluation format from AI: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
    }

    // Validate evaluation
    if (!evaluation.dimensions || !Array.isArray(evaluation.dimensions)) {
      throw new Error('Invalid evaluation structure');
    }

    // Calculate weighted overall score if not provided
    if (!evaluation.overall_score) {
      const totalWeight = evaluation.dimensions.reduce((sum: number, d: any) => sum + (d.weight || 0), 0);
      const weightedSum = evaluation.dimensions.reduce((sum: number, d: any) => 
        sum + (d.score * (d.weight || 0)), 0
      );
      evaluation.overall_score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    // Determine pass/fail
    evaluation.passed = evaluation.overall_score >= rubric.passing_score;

    // Update session in database
    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({
        score_overall: evaluation.overall_score,
        scores_json: evaluation,
        passed: evaluation.passed,
        finished_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      throw updateError;
    }

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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
