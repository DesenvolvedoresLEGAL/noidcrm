// Market Search — Etapa 1: interpretação do alvo em linguagem natural.
// Transforma "agências de eventos em São Paulo" em um plano de consultas
// (sinônimos, variações geográficas, termos negativos) usado pelo fan-out.

export interface MarketPlan {
  segment: string;
  city: string | null;
  state: string | null;
  queries: string[];
  places_queries: string[];
  negative_terms: string[];
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function fallbackPlan(target: string, segment: string, city: string | null, state: string | null): MarketPlan {
  const seg = segment || target;
  const geo = [city, state].filter(Boolean).join(" - ");
  const base = geo ? `${seg} em ${geo}` : seg;
  return {
    segment: seg,
    city,
    state,
    queries: [
      base,
      `empresas de ${base}`,
      `lista de ${base}`,
      `melhores ${base}`,
      `${seg} contato telefone ${geo}`.trim(),
      `diretório de ${base}`,
    ].filter((q, i, arr) => q && arr.indexOf(q) === i),
    places_queries: [base, `${seg} ${geo}`.trim()].filter((q, i, arr) => q && arr.indexOf(q) === i),
    negative_terms: ["vagas", "emprego", "curso", "notícia", "wikipedia"],
  };
}

export async function buildMarketPlan(params: {
  apiKey: string | null;
  target: string;
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  icpContext?: string;
}): Promise<MarketPlan> {
  const target = (params.target || "").trim();
  const segment = (params.segment || "").trim();
  const city = (params.city || "").trim() || null;
  const state = (params.state || "").trim() || null;
  const fallback = fallbackPlan(target, segment, city, state);

  if (!params.apiKey || !target) return fallback;

  try {
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              `Você planeja buscas B2B no Brasil. A partir do alvo descrito pelo usuário, gere um plano de consultas.
Regras: nunca invente empresas; produza de 6 a 10 consultas variadas (sinônimos do segmento, "empresas de X em Y",
listas/associações/diretórios setoriais, bairros ou regiões relevantes) e 2 a 4 consultas curtas para busca local
(Google Places, formato "segmento cidade"). Inclua termos negativos (assuntos que poluem a busca).
${params.icpContext || ""}`,
          },
          {
            role: "user",
            content: `Alvo: ${target}\nSegmento informado: ${segment || "(não informado)"}\nCidade: ${city || "(não informada)"}\nUF: ${state || "(não informada)"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "build_market_plan",
              description: "Plano de consultas para prospecção de mercado",
              parameters: {
                type: "object",
                properties: {
                  segment: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  queries: { type: "array", items: { type: "string" } },
                  places_queries: { type: "array", items: { type: "string" } },
                  negative_terms: { type: "array", items: { type: "string" } },
                },
                required: ["segment", "queries", "places_queries", "negative_terms"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_market_plan" } },
      }),
    });

    if (!resp.ok) return fallback;
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return fallback;
    const parsed = JSON.parse(args);

    const queries = (parsed.queries || []).filter((q: unknown) => typeof q === "string" && q.trim()).slice(0, 10);
    const placesQueries = (parsed.places_queries || []).filter((q: unknown) => typeof q === "string" && q.trim()).slice(0, 4);

    return {
      segment: parsed.segment?.trim() || fallback.segment,
      city: parsed.city?.trim() || city,
      state: parsed.state?.trim() || state,
      queries: queries.length > 0 ? queries : fallback.queries,
      places_queries: placesQueries.length > 0 ? placesQueries : fallback.places_queries,
      negative_terms: (parsed.negative_terms || fallback.negative_terms).filter(
        (t: unknown) => typeof t === "string" && t.trim(),
      ),
    };
  } catch (_err) {
    return fallback;
  }
}
