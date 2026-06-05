/**
 * Sprint WL-LOSS-04 — Avaliação determinística do diagnóstico de perda.
 *
 * Fonte oficial (auditoria PARTE 2):
 *  - Motivo: `opportunities.loss_reason_id` (espelhado em `win_loss_records.reason_id`).
 *    Resolvido em `useWinLossData` como `deal.reason.{name, category, loss_accountability}`.
 *  - Descrição: `opportunities.loss_comment` (espelhado em `win_loss_records.reason_seller`).
 *    Resolvido em `useWinLossData` como `deal.reason_seller`.
 *
 * Estas funções NÃO leem do banco e NÃO dependem da tabela `loss_semantic_analyses`
 * (que só é populada via edge `ai-loss-semantic-analyzer`). Permitem que o CRM Trust
 * Score e o bloco "Motivo Declarado x Motivo Inferido" reflitam o preenchimento real
 * do usuário mesmo sem IA executada.
 */
import type { WinLossDeal } from '@/hooks/useWinLossData';

// ── CRM Trust Score (PARTE 3) ────────────────────────────────────────
// Regra por oportunidade perdida:
//   sem motivo selecionado .................. 0
//   motivo sem descrição .................... 20
//   descrição curta  (<30 chars) ............ 40
//   descrição razoável  (30-99 chars) ....... 60
//   descrição detalhada  (>=100 chars) ...... 80
//   descrição detalhada + motivo coerente ... 100
//
// Score final = média aritmética dos scores individuais.
export interface CrmTrustResult {
  score: number; // 0-100
  analyzed: number;
  bucket: 'frágil' | 'atenção' | 'confiável';
  breakdown: {
    sem_motivo: number;
    motivo_sem_desc: number;
    desc_curta: number;
    desc_razoavel: number;
    desc_detalhada: number;
    desc_detalhada_coerente: number;
  };
}

/**
 * Heurística determinística simples para inferir uma categoria a partir do
 * texto livre da descrição (PARTE 4). Não usa IA. Cobre os 7 buckets oficiais.
 */
export function inferCategoryFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // Ordem importa: mais específico primeiro.
  if (/\b(concorr|fornecedor|outra empresa|outro fornecedor|homologad|escolheu .*concorr)\b/.test(t)) return 'competition';
  if (/\b(pre[çc]o|caro|barato|valor|desconto|or[çc]amento .*alto|fora do or[çc]amento|mais barato)\b/.test(t)) return 'price';
  if (/\b(sem or[çc]amento|adiar|adiou|postergou|sem urg[êe]ncia|n[ãa]o ?[ée] prioridade|momento|tempo|prazo)\b/.test(t)) return 'timing';
  if (/\b(n[ãa]o ?serve|fora do perfil|n[ãa]o atende|sem fit|n[ãa]o ?se enquadra|funcionalidade|feature|produto n[ãa]o)\b/.test(t)) return 'no_fit';
  if (/\b(opera[çc][ãa]o|implanta[çc][ãa]o|instala[çc][ãa]o|suporte|atendimento p[óo]s|entrega)\b/.test(t)) return 'operational';
  if (/\b(erro interno|nosso erro|atraso na proposta|falha interna|esquec|n[ãa]o respond)\b/.test(t)) return 'internal';
  if (/\b(processo comercial|follow ?up|cad[êe]ncia|sla|reuni[ãa]o|abordagem)\b/.test(t)) return 'sales_process';
  return null;
}

function classifyDeal(deal: WinLossDeal): keyof CrmTrustResult['breakdown'] {
  const reason = (deal.reason as any)?.name as string | undefined;
  const desc = (deal.reason_seller || '').trim();
  if (!reason) return 'sem_motivo';
  if (!desc) return 'motivo_sem_desc';
  if (desc.length < 30) return 'desc_curta';
  if (desc.length < 100) return 'desc_razoavel';
  // >=100 chars — checar coerência
  const declared = (deal.reason as any)?.category as string | undefined;
  const inferred = inferCategoryFromText(desc);
  if (declared && inferred && declared === inferred) return 'desc_detalhada_coerente';
  return 'desc_detalhada';
}

const BUCKET_SCORE: Record<keyof CrmTrustResult['breakdown'], number> = {
  sem_motivo: 0,
  motivo_sem_desc: 20,
  desc_curta: 40,
  desc_razoavel: 60,
  desc_detalhada: 80,
  desc_detalhada_coerente: 100,
};

export function computeCrmTrust(losses: WinLossDeal[]): CrmTrustResult {
  const breakdown: CrmTrustResult['breakdown'] = {
    sem_motivo: 0,
    motivo_sem_desc: 0,
    desc_curta: 0,
    desc_razoavel: 0,
    desc_detalhada: 0,
    desc_detalhada_coerente: 0,
  };
  if (losses.length === 0) {
    return { score: 0, analyzed: 0, bucket: 'frágil', breakdown };
  }
  let sum = 0;
  for (const l of losses) {
    const b = classifyDeal(l);
    breakdown[b]++;
    sum += BUCKET_SCORE[b];
  }
  const score = Math.round(sum / losses.length);
  const bucket: CrmTrustResult['bucket'] =
    score >= 80 ? 'confiável' : score >= 60 ? 'atenção' : 'frágil';
  return { score, analyzed: losses.length, bucket, breakdown };
}

// ── Declarado × Inferido determinístico (PARTE 4) ────────────────────
export interface DeclaredVsInferred {
  /** Perdas com motivo declarado E descrição com tamanho útil (>=30c). */
  analyzed: number;
  coherent: number;
  divergent: number;
  inconclusive: number; // descrição existe mas heurística não inferiu nada
  /** Taxa de divergência sobre as analisadas com inferência conclusiva. */
  divergenceRate: number; // 0-100
  /** Pares declarado → inferido mais frequentes (apenas divergentes). */
  pairs: Array<{ declared: string; inferred: string; count: number; value: number }>;
  /** Volume mínimo atingido para exibir o bloco. */
  hasMinimumVolume: boolean;
}

const MIN_VOLUME = 5;

export function computeDeclaredVsInferred(losses: WinLossDeal[]): DeclaredVsInferred {
  let analyzed = 0;
  let coherent = 0;
  let divergent = 0;
  let inconclusive = 0;
  const pairMap = new Map<string, { count: number; value: number }>();

  for (const l of losses) {
    const declared = (l.reason as any)?.category as string | undefined;
    const desc = (l.reason_seller || '').trim();
    if (!declared || desc.length < 30) continue;
    analyzed++;
    const inferred = inferCategoryFromText(desc);
    if (!inferred) {
      inconclusive++;
      continue;
    }
    if (inferred === declared) {
      coherent++;
    } else {
      divergent++;
      const key = `${declared}→${inferred}`;
      const e = pairMap.get(key) || { count: 0, value: 0 };
      e.count++;
      e.value += Number(l.final_value) || 0;
      pairMap.set(key, e);
    }
  }

  const conclusive = coherent + divergent;
  const divergenceRate = conclusive > 0 ? Math.round((divergent / conclusive) * 100) : 0;

  const pairs = [...pairMap.entries()]
    .map(([k, v]) => {
      const [declared, inferred] = k.split('→');
      return { declared, inferred, count: v.count, value: v.value };
    })
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, 5);

  return {
    analyzed,
    coherent,
    divergent,
    inconclusive,
    divergenceRate,
    pairs,
    hasMinimumVolume: analyzed >= MIN_VOLUME,
  };
}
