import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  entity_type: 'accounts' | 'contacts' | 'opportunities';
  data: any[];
  column_mapping: Record<string, string>;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ row: number; field: string; message: string; }>;
  warnings: Array<{ row: number; field: string; message: string; }>;
  duplicates: Array<{ row: number; field: string; value: any; existingId: string; }>;
  aiSuggestions: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { entity_type, data, column_mapping }: ValidationRequest = await req.json();

    // Input validation
    if (!entity_type || !['accounts', 'contacts', 'opportunities'].includes(entity_type)) {
      return new Response(JSON.stringify({ error: 'Invalid entity type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ error: 'No data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (data.length > 5000) {
      return new Response(JSON.stringify({ error: 'Maximum 5000 rows allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      duplicates: [],
      aiSuggestions: [],
    };

    // Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      await validateRow(supabaseClient, entity_type, row, i, orgMember.organization_id, result);
    }

    // Call AI for intelligent validation (in batches)
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const aiValidation = await validateWithAI(entity_type, batch, i);
      result.aiSuggestions.push(...aiValidation);
    }

    result.valid = result.errors.length === 0;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function validateRow(
  supabase: any,
  entityType: string,
  row: any,
  rowIndex: number,
  orgId: string,
  result: ValidationResult
) {
  switch (entityType) {
    case 'accounts':
      await validateAccount(supabase, row, rowIndex, orgId, result);
      break;
    case 'contacts':
      await validateContact(supabase, row, rowIndex, orgId, result);
      break;
    case 'opportunities':
      await validateOpportunity(supabase, row, rowIndex, orgId, result);
      break;
  }
}

async function validateAccount(
  supabase: any,
  row: any,
  rowIndex: number,
  orgId: string,
  result: ValidationResult
) {
  // Required field: razao_social
  if (!row.razao_social || row.razao_social.trim() === '') {
    result.errors.push({
      row: rowIndex,
      field: 'razao_social',
      message: 'Razão social é obrigatória',
    });
  }

  // Validate CNPJ format if provided
  if (row.cnpj) {
    const cnpjClean = row.cnpj.replace(/\D/g, '');
    if (cnpjClean.length !== 14) {
      result.errors.push({
        row: rowIndex,
        field: 'cnpj',
        message: 'CNPJ deve ter 14 dígitos',
      });
    } else {
      // Check duplicate CNPJ
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('cnpj', row.cnpj)
        .single();

      if (existing) {
        result.duplicates.push({
          row: rowIndex,
          field: 'cnpj',
          value: row.cnpj,
          existingId: existing.id,
        });
      }
    }
  }

  // Validate tamanho enum
  if (row.tamanho && !['Micro', 'Pequena', 'Média', 'Grande'].includes(row.tamanho)) {
    result.warnings.push({
      row: rowIndex,
      field: 'tamanho',
      message: `Tamanho "${row.tamanho}" não é padrão. Valores esperados: Micro, Pequena, Média, Grande`,
    });
  }
}

async function validateContact(
  supabase: any,
  row: any,
  rowIndex: number,
  orgId: string,
  result: ValidationResult
) {
  // Required field: nome
  if (!row.nome || row.nome.trim() === '') {
    result.errors.push({
      row: rowIndex,
      field: 'nome',
      message: 'Nome é obrigatório',
    });
  }

  // Validate emails array
  if (row.emails && Array.isArray(row.emails)) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of row.emails) {
      if (!emailRegex.test(email)) {
        result.errors.push({
          row: rowIndex,
          field: 'emails',
          message: `Email inválido: ${email}`,
        });
      }
    }
  }

  // Validate account_id if provided
  if (row.account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', row.account_id)
      .eq('organization_id', orgId)
      .single();

    if (!account) {
      result.errors.push({
        row: rowIndex,
        field: 'account_id',
        message: 'Empresa vinculada não existe',
      });
    }
  }
}

async function validateOpportunity(
  supabase: any,
  row: any,
  rowIndex: number,
  orgId: string,
  result: ValidationResult
) {
  // Required field: title
  if (!row.title || row.title.trim() === '') {
    result.errors.push({
      row: rowIndex,
      field: 'title',
      message: 'Título é obrigatório',
    });
  }

  // Validate valor_previsto
  if (row.valor_previsto !== undefined && row.valor_previsto !== null) {
    const value = parseFloat(row.valor_previsto);
    if (isNaN(value) || value < 0) {
      result.errors.push({
        row: rowIndex,
        field: 'valor_previsto',
        message: 'Valor previsto deve ser um número positivo',
      });
    }
  }

  // Validate prob (0-100)
  if (row.prob !== undefined && row.prob !== null) {
    const prob = parseInt(row.prob);
    if (isNaN(prob) || prob < 0 || prob > 100) {
      result.errors.push({
        row: rowIndex,
        field: 'prob',
        message: 'Probabilidade deve estar entre 0 e 100',
      });
    }
  }

  // Validate temperature enum
  if (row.temperature && !['cold', 'warm', 'hot', 'burning'].includes(row.temperature)) {
    result.warnings.push({
      row: rowIndex,
      field: 'temperature',
      message: `Temperatura "${row.temperature}" não é padrão. Valores esperados: cold, warm, hot, burning`,
    });
  }

  // Validate account_id if provided
  if (row.account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', row.account_id)
      .eq('organization_id', orgId)
      .single();

    if (!account) {
      result.errors.push({
        row: rowIndex,
        field: 'account_id',
        message: 'Empresa vinculada não existe',
      });
    }
  }

  // Validate contact_id if provided
  if (row.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', row.contact_id)
      .eq('organization_id', orgId)
      .single();

    if (!contact) {
      result.errors.push({
        row: rowIndex,
        field: 'contact_id',
        message: 'Contato vinculado não existe',
      });
    }
  }
}

async function validateWithAI(entityType: string, batch: any[], startIndex: number) {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.warn('LOVABLE_API_KEY not configured, skipping AI validation');
      return [];
    }

    const prompt = `Analise os seguintes dados de importação de ${entityType}:

${JSON.stringify(batch, null, 2)}

Para cada registro, identifique:
1. Possíveis duplicatas semânticas (ex: "Microsoft Corp" vs "Microsoft Corporation")
2. Dados malformados que podem ser corrigidos automaticamente
3. Inconsistências nos dados

Retorne um array JSON com sugestões no formato:
[
  {
    "row": <index>,
    "type": "duplicate" | "correction" | "warning",
    "field": "<campo>",
    "message": "<descrição>",
    "suggestion": "<valor sugerido se aplicável>"
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente especializado em validação de dados de CRM.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error('AI validation failed:', response.status);
      return [];
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (aiResponse) {
      try {
        const parsed = JSON.parse(aiResponse);
        // Adjust row indices to global position
        return Array.isArray(parsed) ? parsed.map((s: any) => ({
          ...s,
          row: s.row + startIndex
        })) : [];
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        return [];
      }
    }

    return [];
  } catch (error) {
    console.error('AI validation error:', error);
    return [];
  }
}
