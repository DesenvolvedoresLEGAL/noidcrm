import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian names for fake client generation
const FIRST_NAMES = [
  'Carlos', 'Ana', 'João', 'Maria', 'Pedro', 'Juliana', 'Ricardo', 'Fernanda',
  'Felipe', 'Beatriz', 'Roberto', 'Camila', 'Eduardo', 'Mariana', 'André',
  'Patrícia', 'Gustavo', 'Luciana', 'Marcelo', 'Renata'
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Araújo', 'Melo', 'Barbosa', 'Rocha', 'Pinto', 'Dias'
];

function generateCNPJ(): string {
  const random = () => Math.floor(Math.random() * 10);
  const num1 = random();
  const num2 = random();
  const num3 = random();
  const num4 = random();
  const num5 = random();
  const num6 = random();
  const num7 = random();
  const num8 = random();
  
  return `${num1}${num2}.${num3}${num4}${num5}.${num6}${num7}${num8}/0001-${random()}${random()}`;
}

// Input validation function
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.icpData || typeof data.icpData !== 'object') {
    return { valid: false, error: 'Invalid ICP data' };
  }
  if (!data.archetypeData || typeof data.archetypeData !== 'object') {
    return { valid: false, error: 'Invalid archetype data' };
  }
  if (data.icpData.segment && typeof data.icpData.segment !== 'string') {
    return { valid: false, error: 'ICP segment must be a string' };
  }
  if (data.icpData.segment && data.icpData.segment.length > 100) {
    return { valid: false, error: 'ICP segment too long' };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { icpId, archetypeId, organizationId, icpData, archetypeData } = await req.json();

    // Validate input
    const validation = validateInput({ icpData, archetypeData });
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build AI prompt for client generation
    const systemPrompt = `You are a sales training AI that generates realistic Brazilian B2B client profiles for roleplay simulations.

Generate a professional, realistic client based on these characteristics:

ICP Profile:
- Segment: ${icpData?.segment || 'Eventos'}
- Company Size: ${icpData?.company_size || 'PME'}
- Pain Points: ${JSON.stringify(icpData?.pain_points || [])}

Client Archetype:
- Type: ${archetypeData?.type || 'Organizador'}
- Level: ${archetypeData?.level || 'Intermediário'}
- Tone: ${archetypeData?.tone_style || 'técnico'}
- Decision Role: ${archetypeData?.decision_role || 'Decisor'}

Generate 3 specific objections this client would likely raise based on their profile and tone.`;

    const userPrompt = `Create a realistic Brazilian B2B client with:
1. A professional first and last name (Brazilian)
2. A company name appropriate for the ${icpData?.segment || 'Events'} industry
3. A job title matching their decision role (${archetypeData?.decision_role || 'Decisor'})
4. Three specific objections they would raise during a sales conversation

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "fake_name": "Full name",
  "fake_company": "Company Name",
  "fake_role": "Job Title",
  "objections": ["objection 1", "objection 2", "objection 3"]
}`;

    // Call Lovable AI API
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
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Parse AI response
    let clientData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      clientData = JSON.parse(cleanContent);
    } catch (parseError) {
      // Fallback to simple generation
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      clientData = {
        fake_name: `${firstName} ${lastName}`,
        fake_company: `${archetypeData?.type || 'Empresa'} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
        fake_role: archetypeData?.decision_role === 'Decisor' ? 'Diretor Comercial' : 'Gerente de Marketing',
        objections: archetypeData?.objection_set?.slice(0, 3) || [
          'Preciso validar com a equipe',
          'Qual o ROI esperado?',
          'Já temos um fornecedor atual'
        ]
      };
    }

    // Generate CNPJ
    const fake_cnpj = generateCNPJ();

    const simulatedClient = {
      fake_name: clientData.fake_name,
      fake_company: clientData.fake_company,
      fake_cnpj,
      fake_role: clientData.fake_role,
      tone_style: archetypeData?.tone_style || 'técnico',
      decision_role: archetypeData?.decision_role || 'Decisor',
      objection_pattern: clientData.objections || [],
      personality_seed: JSON.stringify({ icpId, archetypeId, timestamp: Date.now() })
    };

    return new Response(
      JSON.stringify({ success: true, client: simulatedClient }),
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
