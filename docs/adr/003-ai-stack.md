# ADR-003: Stack de Inteligência Artificial

## Status

Aceito

## Data

2024-02-01

## Contexto

O sistema requer capacidades de IA para:
- Scoring de leads e oportunidades
- Previsões de vendas (forecast)
- Sugestões e recomendações inteligentes
- Automação de tarefas repetitivas
- Análise de sentimento e insights

### Forças em Jogo
- **Custo**: APIs de IA têm custo por token/request
- **Latência**: Respostas rápidas são essenciais para UX
- **Qualidade**: Modelos maiores têm melhor qualidade
- **Privacidade**: Dados sensíveis de clientes
- **Manutenção**: Dependência de providers externos

## Decisão

> Nós decidimos usar **Lovable AI (modelos suportados)** como provider principal, com **arquitetura de camadas** para diferentes casos de uso.

### Camadas de IA

1. **Tier 1 - Alta Precisão** (decisões críticas):
   - Modelo: `google/gemini-2.5-pro` ou `openai/gpt-5`
   - Uso: Scoring final, previsões de forecast, análises complexas

2. **Tier 2 - Balanceado** (uso geral):
   - Modelo: `google/gemini-2.5-flash` ou `openai/gpt-5-mini`
   - Uso: Sugestões, resumos, classificações

3. **Tier 3 - Alto Volume** (operações simples):
   - Modelo: `google/gemini-2.5-flash-lite` ou `openai/gpt-5-nano`
   - Uso: Categorização, extração de entidades, validações

## Alternativas Consideradas

### Alternativa 1: OpenAI Direto
- **Prós**: Qualidade comprovada, documentação extensa
- **Contras**: Vendor lock-in, custo, requer API key do usuário

### Alternativa 2: Modelos Open Source (self-hosted)
- **Prós**: Controle total, sem custo por request
- **Contras**: Infraestrutura complexa, qualidade inferior, manutenção

### Alternativa 3: Sem IA (regras estáticas)
- **Prós**: Previsível, sem custo
- **Contras**: Não escala, não aprende, UX inferior

## Consequências

### Positivas
- **Sem API Key**: Lovable AI não requer configuração do usuário
- **Multi-modelo**: Flexibilidade para escolher modelo por caso de uso
- **Custo otimizado**: Modelos menores para tarefas simples
- **Fallback**: Se um modelo falha, pode usar alternativa

### Negativas
- **Dependência de Lovable**: Limitado aos modelos suportados
- **Latência variável**: Depende do modelo e carga
- **Custo em Volts**: Consumo precisa ser monitorado

### Riscos
- **Modelo indisponível**: Implementar retry com fallback
- **Respostas inconsistentes**: Validação de output obrigatória
- **Custo inesperado**: Implementar circuit breaker por org

## Implementação

```typescript
// Seleção de modelo por caso de uso
const AI_MODELS = {
  scoring: 'google/gemini-2.5-pro',      // Tier 1
  suggestions: 'google/gemini-2.5-flash', // Tier 2
  classification: 'google/gemini-2.5-flash-lite', // Tier 3
} as const;

// Estrutura de chamada com retry
async function callAI(
  feature: keyof typeof AI_MODELS,
  prompt: string,
  context: Record<string, unknown>
) {
  const model = AI_MODELS[feature];
  
  try {
    const result = await lovableAI.generate({
      model,
      prompt,
      context,
    });
    
    // Log para auditoria
    await logAIUsage({
      feature,
      model,
      tokens: result.usage,
      success: true,
    });
    
    return result;
  } catch (error) {
    // Fallback para modelo alternativo
    return callAIWithFallback(feature, prompt, context);
  }
}
```

## Tabelas de Suporte

```sql
-- Registro de uso de IA
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    feature TEXT NOT NULL,
    model_used TEXT NOT NULL,
    tokens_input INT,
    tokens_output INT,
    volts_used DECIMAL,
    latency_ms INT,
    success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração de limites por org
CREATE TABLE ai_config (
    organization_id UUID PRIMARY KEY,
    monthly_volts_limit INT DEFAULT 10000,
    enabled_features TEXT[] DEFAULT ARRAY['scoring', 'suggestions'],
    preferred_models JSONB
);
```

## Referências

- [Lovable AI Supported Models](https://docs.lovable.dev/features/ai)
- Tabelas: `ai_usage_logs`, `ai_runs`, `ai_scores`
