// Market Search — fonte de pesquisa citada: Perplexity Sonar.
// Opcional: se PERPLEXITY_API_KEY não estiver configurada, o motor roda sem esta fonte.

export interface PerplexityAnswer {
  content: string;
  citations: string[];
}

export async function perplexitySearch(params: {
  apiKey: string;
  query: string;
  model?: string;
}): Promise<PerplexityAnswer> {
  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || "sonar",
      messages: [
        {
          role: "system",
          content:
            "Liste empresas REAIS que atendam ao pedido, uma por linha, no formato: Nome da empresa | site | cidade/UF | telefone (se público). Nunca invente dados; omita o campo se não souber.",
        },
        { role: "user", content: params.query },
      ],
      search_recency_filter: "year",
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 401 && body.includes("insufficient_quota")) {
      throw new Error(
        "Créditos da Perplexity esgotados. Compre créditos de API em https://console.perplexity.ai para a conta desta chave.",
      );
    }
    throw new Error(`Perplexity ${resp.status}: ${body.substring(0, 300)}`);
  }

  const data = await resp.json();
  return {
    content: data?.choices?.[0]?.message?.content || "",
    citations: Array.isArray(data?.citations) ? data.citations : [],
  };
}
