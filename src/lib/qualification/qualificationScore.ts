// Sprint 2 — Score de Qualificação
// Pure calculation library. No I/O. Same input always -> same output.

export type QualificationTier =
  | 'cold'
  | 'developing'
  | 'sql_weak'
  | 'sql_valid'
  | 'sql_priority';

export interface QualificationClassification {
  tier: QualificationTier;
  label: string;
  /** Tailwind utility classes (uses semantic tokens where possible). */
  colorClass: string;
}

export interface QualificationBreakdownItem {
  key: string;
  label: string;
  got: number;
  max: number;
}

export interface QualificationScoreResult {
  total: number;
  breakdown: QualificationBreakdownItem[];
  classification: QualificationClassification;
  /** Pending items required for move-to-Sales. */
  blockers: string[];
  /** Score >= 75 AND all mandatory items filled AND permissao_proposta is valid. */
  canMoveToSales: boolean;
}

export interface QualificationContext {
  hasAccount: boolean;
  hasContact: boolean;
}

/** Allowed values for `permissao_proposta` that count as real permission. */
export const VALID_PERMISSAO = new Set([
  'cliente_pediu_proposta',
  'cliente_validou_escopo',
  'cliente_confirmou_interesse',
]);

const URGENCIA_POINTS: Record<string, number> = {
  ate_3_dias: 15,
  '4_a_9_dias': 15,
  '10_a_20_dias': 12,
  '21_a_30_dias': 10,
  acima_30_dias: 6,
  sem_data: 0,
};

const PODER_POINTS: Record<string, number> = {
  decisor_final: 15,
  influenciador_direto: 12,
  comprador_financeiro: 10,
  usuario_tecnico: 6,
  apenas_pesquisando: 2,
  nao_identificado: 0,
};

const PROXIMO_PASSO_POINTS: Record<string, number> = {
  enviar_proposta: 10,
  agendar_reuniao: 8,
  validar_escopo: 6,
  validar_orcamento: 6,
  aguardar_retorno: 3,
  sem_proximo_passo: 0,
};

const PERMISSAO_POINTS: Record<string, number> = {
  cliente_pediu_proposta: 5,
  cliente_validou_escopo: 5,
  cliente_confirmou_interesse: 5,
  sdr_sugerindo: 0,
  sem_permissao: 0,
};

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export function classifyScore(total: number): QualificationClassification {
  if (total >= 90)
    return {
      tier: 'sql_priority',
      label: 'SQL prioritário',
      colorClass:
        'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    };
  if (total >= 75)
    return {
      tier: 'sql_valid',
      label: 'SQL válido',
      colorClass:
        'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    };
  if (total >= 60)
    return {
      tier: 'sql_weak',
      label: 'SQL fraco',
      colorClass:
        'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
    };
  if (total >= 40)
    return {
      tier: 'developing',
      label: 'Em desenvolvimento',
      colorClass:
        'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
    };
  return {
    tier: 'cold',
    label: 'Frio',
    colorClass:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  };
}

export function computeQualificationScore(
  valuesByKey: Record<string, unknown>,
  ctx: QualificationContext = { hasAccount: false, hasContact: false }
): QualificationScoreResult {
  const v = valuesByKey ?? {};

  const has = (k: string) => isFilled(v[k]);

  // 1. Evento identificado (20)
  const nomeOk = has('nome_evento');
  const dataOk = has('data_evento');
  const localOk = has('local_evento');
  const evento =
    nomeOk && dataOk && localOk
      ? 20
      : (nomeOk ? 7 : 0) + (dataOk ? 7 : 0) + (localOk ? 6 : 0);

  // 2. Demanda clara (20)
  const conexOk = has('conexoes_simultaneas');
  const equipOk = has('equipamentos');
  const finOk = has('finalidade_uso');
  const demanda =
    conexOk && equipOk && finOk
      ? 20
      : (conexOk ? 8 : 0) + (equipOk ? 6 : 0) + (finOk ? 6 : 0);

  // 3. Data e local definidos (15)
  const dataLocal =
    dataOk && localOk ? 15 : (dataOk ? 8 : 0) + (localOk ? 7 : 0);

  // 4. Urgência real (15)
  const urgVal = typeof v.urgencia_real === 'string' ? v.urgencia_real : '';
  const urgencia = URGENCIA_POINTS[urgVal] ?? 0;

  // 5. Poder ou influência (15)
  const poderVal = typeof v.poder_decisao === 'string' ? v.poder_decisao : '';
  const poder = PODER_POINTS[poderVal] ?? 0;

  // 6. Próximo passo combinado (10)
  const proxVal = typeof v.proximo_passo === 'string' ? v.proximo_passo : '';
  const proximo = PROXIMO_PASSO_POINTS[proxVal] ?? 0;

  // 7. Permissão real para proposta (5)
  const permVal =
    typeof v.permissao_proposta === 'string' ? v.permissao_proposta : '';
  const permissao = PERMISSAO_POINTS[permVal] ?? 0;

  const breakdown: QualificationBreakdownItem[] = [
    { key: 'evento', label: 'Evento identificado', got: evento, max: 20 },
    { key: 'demanda', label: 'Demanda clara', got: demanda, max: 20 },
    { key: 'data_local', label: 'Data e local definidos', got: dataLocal, max: 15 },
    { key: 'urgencia', label: 'Urgência real', got: urgencia, max: 15 },
    { key: 'poder', label: 'Poder ou influência', got: poder, max: 15 },
    { key: 'proximo_passo', label: 'Próximo passo combinado', got: proximo, max: 10 },
    { key: 'permissao', label: 'Permissão real para proposta', got: permissao, max: 5 },
  ];

  const total = breakdown.reduce((s, b) => s + b.got, 0);
  const classification = classifyScore(total);

  // Blockers (mandatory checklist for handoff to Sales)
  const blockers: string[] = [];
  if (!ctx.hasAccount) blockers.push('Nome da empresa');
  if (!ctx.hasContact) blockers.push('Nome do contato');
  if (!nomeOk) blockers.push('Nome do evento');
  if (!dataOk) blockers.push('Data do evento');
  if (!localOk) blockers.push('Local do evento');
  if (!conexOk) blockers.push('Quantidade de conexões');
  if (!finOk) blockers.push('Finalidade de uso');
  if (!has('urgencia_real')) blockers.push('Urgência real');
  if (!has('poder_decisao')) blockers.push('Poder ou influência');
  if (!has('proximo_passo')) blockers.push('Próximo passo combinado');
  if (!VALID_PERMISSAO.has(permVal))
    blockers.push('Permissão real para proposta válida');

  const canMoveToSales = total >= 75 && blockers.length === 0;

  return { total, breakdown, classification, blockers, canMoveToSales };
}
