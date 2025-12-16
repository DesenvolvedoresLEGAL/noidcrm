import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  organization_id: string;
  query: string;
  memory_types?: string[];
  industry?: string;
  stage?: string;
  limit?: number;
}

// Simple text similarity using TF-IDF-like approach
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => 
    text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  
  const words1 = normalize(text1);
  const words2 = normalize(text2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate word frequency maps
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();
  
  words1.forEach(w => freq1.set(w, (freq1.get(w) || 0) + 1));
  words2.forEach(w => freq2.set(w, (freq2.get(w) || 0) + 1));
  
  // Calculate intersection
  let intersection = 0;
  freq1.forEach((count, word) => {
    if (freq2.has(word)) {
      intersection += Math.min(count, freq2.get(word)!);
    }
  });
  
  // Jaccard-like similarity with word frequency
  const union = words1.length + words2.length - intersection;
  const baseSimilarity = union > 0 ? intersection / union : 0;
  
  // Boost for exact phrase matches
  const phraseBoost = text2.toLowerCase().includes(text1.toLowerCase()) ? 0.3 : 0;
  
  // Boost for keyword matches
  const queryKeywords = words1;
  const keywordMatches = queryKeywords.filter(w => 
    words2.some(w2 => w2.includes(w) || w.includes(w2))
  ).length;
  const keywordBoost = queryKeywords.length > 0 ? (keywordMatches / queryKeywords.length) * 0.2 : 0;
  
  return Math.min(1, baseSimilarity + phraseBoost + keywordBoost);
}

// Expand query with synonyms and related terms
function expandQuery(query: string): string[] {
  const synonyms: Record<string, string[]> = {
    'preço': ['valor', 'custo', 'investimento', 'orçamento', 'budget', 'caro', 'barato'],
    'caro': ['preço', 'valor alto', 'custo elevado', 'investimento'],
    'objeção': ['resistência', 'barreira', 'problema', 'dificuldade', 'impedimento'],
    'concorrente': ['competidor', 'rival', 'alternativa', 'outro fornecedor'],
    'decisão': ['aprovação', 'fechamento', 'assinatura', 'ok', 'sim'],
    'urgência': ['pressa', 'rápido', 'deadline', 'prazo', 'agora'],
    'roi': ['retorno', 'resultado', 'benefício', 'economia', 'ganho'],
    'implementação': ['implantação', 'instalação', 'setup', 'configuração'],
    'suporte': ['atendimento', 'ajuda', 'assistência', 'help desk'],
    'contrato': ['acordo', 'proposta', 'documento', 'assinatura'],
    'desconto': ['redução', 'abatimento', 'promoção', 'condição especial'],
    'prazo': ['tempo', 'período', 'duração', 'deadline'],
    'risco': ['incerteza', 'problema', 'dúvida', 'preocupação'],
    'ganho': ['vitória', 'sucesso', 'fechamento', 'win'],
    'perda': ['derrota', 'não fechou', 'perdido', 'loss'],
    'churn': ['cancelamento', 'saída', 'desistência', 'abandono'],
  };
  
  const terms = [query];
  const queryLower = query.toLowerCase();
  
  Object.entries(synonyms).forEach(([key, values]) => {
    if (queryLower.includes(key)) {
      terms.push(...values);
    }
    values.forEach(value => {
      if (queryLower.includes(value)) {
        terms.push(key);
      }
    });
  });
  
  return [...new Set(terms)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      organization_id, 
      query, 
      memory_types, 
      industry, 
      stage, 
      limit = 10 
    }: SearchRequest = await req.json();

    if (!organization_id || !query) {
      return new Response(
        JSON.stringify({ error: "organization_id and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Expand query with synonyms
    const expandedTerms = expandQuery(query);
    console.log("Expanded query terms:", expandedTerms);

    // Build base query
    let dbQuery = supabase
      .from("memories")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("status", "active");

    // Filter by memory types if specified
    if (memory_types && memory_types.length > 0) {
      dbQuery = dbQuery.in("memory_type", memory_types);
    }

    // Filter by industry if specified
    if (industry) {
      dbQuery = dbQuery.or(`industry.eq.${industry},industry.is.null`);
    }

    // Filter by stage if specified
    if (stage) {
      dbQuery = dbQuery.or(`stage.eq.${stage},stage.is.null`);
    }

    const { data: memories, error: fetchError } = await dbQuery;

    if (fetchError) {
      console.error("Error fetching memories:", fetchError);
      throw fetchError;
    }

    if (!memories || memories.length === 0) {
      return new Response(
        JSON.stringify({ memories: [], query_expansion: expandedTerms }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate semantic similarity for each memory
    const scoredMemories = memories.map(memory => {
      // Combine title, content, and keywords for matching
      const memoryText = [
        memory.title,
        memory.content,
        ...(memory.keywords || [])
      ].join(" ");

      // Calculate similarity against all expanded terms
      let maxSimilarity = 0;
      for (const term of expandedTerms) {
        const similarity = calculateSimilarity(term, memoryText);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // Boost based on memory quality metrics
      const confidenceBoost = (memory.confidence_score || 0.5) * 0.1;
      const successBoost = (memory.success_rate || 0) * 0.1;
      const recencyBoost = memory.last_used_at 
        ? Math.max(0, 0.1 - (Date.now() - new Date(memory.last_used_at).getTime()) / (1000 * 60 * 60 * 24 * 30) * 0.1)
        : 0;

      return {
        ...memory,
        similarity_score: Math.min(1, maxSimilarity + confidenceBoost + successBoost + recencyBoost),
        matched_terms: expandedTerms.filter(term => 
          memoryText.toLowerCase().includes(term.toLowerCase())
        )
      };
    });

    // Filter by minimum similarity and sort
    const relevantMemories = scoredMemories
      .filter(m => m.similarity_score > 0.1)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    // Record memory reads for tracking
    for (const memory of relevantMemories.slice(0, 3)) {
      await supabase.from("memory_reads").insert({
        organization_id,
        memory_id: memory.id,
        read_context: "semantic_search",
        triggered_by: "ai_function",
        ai_function: "semantic-memory-search"
      });
    }

    return new Response(
      JSON.stringify({ 
        memories: relevantMemories,
        query_expansion: expandedTerms,
        total_searched: memories.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in semantic-memory-search:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
