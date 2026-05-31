/**
 * Pontuação determinística (0-100) da qualidade do diagnóstico de perda.
 *
 * Pura, sem chamadas externas, testável.
 *
 * Critérios (somam até 100):
 *  - Texto ≥ 100 chars (vendedor OU cliente): 20
 *  - Causa identificável (verbos causais/conjunções explicativas): 20
 *  - Contexto de negociação (stage, prazo, decisor, proposta, reunião): 15
 *  - Menção a concorrente / preço / timing / produto / operação: 15
 *  - Ação possível (verbo de ação ou recommended_action presente): 15
 *  - Baixa contradição com motivo selecionado pelo vendedor: 15
 */

export interface DiagnosisQualityInput {
  sellerDiagnosis?: string | null;
  customerComment?: string | null;
  freeText?: string | null;
  /** Categoria/motivo selecionado pelo vendedor (humano). */
  sellerSelectedCategory?: string | null;
  /** Categoria inferida pela IA, se houver. */
  aiDetectedCategory?: string | null;
  /** Texto de ação recomendada já gerado, se houver. */
  recommendedAction?: string | null;
}

export interface DiagnosisQualityResult {
  score: number; // 0-100
  bucket: 'strong' | 'medium' | 'weak' | 'missing';
  breakdown: Record<string, number>;
}

const CAUSE_REGEX = /\b(porque|pois|devido|por causa|em razão|já que|uma vez que|motivo|gerou|provocou|resultou em|por conta de|fizemos|escolheram?)\b/i;
const CONTEXT_REGEX = /\b(proposta|reunião|reuniao|negocia[cç][ãa]o|prazo|deadline|decisor|cliente|stage|etapa|orçamento|or[cç]amento|aprova[cç][ãa]o|contrato|envio)\b/i;
const TOPIC_REGEX = /\b(pre[cç]o|caro|barato|valor|desconto|concorr[êe]ncia|concorrente|fornecedor|timing|tempo|prazo|urg[êe]ncia|produto|funcionalidade|feature|opera[cç][ãa]o|implanta[cç][ãa]o|suporte|instala[cç][ãa]o|equipamento)\b/i;
const ACTION_REGEX = /\b(revisar|criar|atualizar|implementar|treinar|alertar|monitorar|recontatar|reativar|negociar|reduzir|priorizar|acompanhar|automatizar|configurar)\b/i;

export function scoreDiagnosisQuality(input: DiagnosisQualityInput): DiagnosisQualityResult {
  const seller = (input.sellerDiagnosis || '').trim();
  const customer = (input.customerComment || '').trim();
  const free = (input.freeText || '').trim();
  const combined = [seller, customer, free].filter(Boolean).join(' \n ');

  const breakdown: Record<string, number> = {
    text_length: 0,
    cause: 0,
    context: 0,
    topic: 0,
    action: 0,
    consistency: 0,
  };

  if (!combined) {
    return { score: 0, bucket: 'missing', breakdown };
  }

  // 1. Tamanho — usa o maior dos dois textos
  const longest = Math.max(seller.length, customer.length, free.length);
  if (longest >= 100) breakdown.text_length = 20;
  else if (longest >= 50) breakdown.text_length = 12;
  else if (longest >= 20) breakdown.text_length = 6;

  // 2. Causa
  if (CAUSE_REGEX.test(combined)) breakdown.cause = 20;
  else if (combined.length > 80) breakdown.cause = 8;

  // 3. Contexto
  if (CONTEXT_REGEX.test(combined)) breakdown.context = 15;
  else if (combined.length > 60) breakdown.context = 5;

  // 4. Tema reconhecível
  if (TOPIC_REGEX.test(combined)) breakdown.topic = 15;

  // 5. Ação possível
  if (input.recommendedAction && input.recommendedAction.trim().length > 10) {
    breakdown.action = 15;
  } else if (ACTION_REGEX.test(combined)) {
    breakdown.action = 10;
  }

  // 6. Consistência humano × IA
  const sellerCat = (input.sellerSelectedCategory || '').toLowerCase().trim();
  const aiCat = (input.aiDetectedCategory || '').toLowerCase().trim();
  if (!sellerCat || !aiCat) {
    breakdown.consistency = 8; // neutro
  } else if (sellerCat === aiCat) {
    breakdown.consistency = 15; // alinhado
  } else {
    breakdown.consistency = 3; // contradição
  }

  const score = Math.min(
    100,
    Object.values(breakdown).reduce((s, v) => s + v, 0),
  );

  const bucket: DiagnosisQualityResult['bucket'] =
    score >= 70 ? 'strong' : score >= 40 ? 'medium' : score > 0 ? 'weak' : 'missing';

  return { score, bucket, breakdown };
}
