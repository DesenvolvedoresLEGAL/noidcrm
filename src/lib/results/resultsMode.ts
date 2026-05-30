/**
 * Modo de Resultados — fonte única para decidir como o módulo Resultados
 * se apresenta (cards, tabelas, labels, abas, export).
 *
 * Mapeamento com a coluna `organizations.goal_system_mode`:
 *   - 'ote'                 → full_ote          (Sistema OTE Completo)
 *   - 'simple'              → simple_goals      (Metas Simples)
 *   - 'standard_commission' → standard_commission (Comissão Padrão)
 */
export type GoalSystemModeRaw = 'ote' | 'simple' | 'standard_commission';
export type ResultsMode = 'full_ote' | 'simple_goals' | 'standard_commission';

export interface OrgWithGoalMode {
  goal_system_mode?: GoalSystemModeRaw | null;
}

export function getResultsMode(org?: OrgWithGoalMode | null): ResultsMode {
  const raw = (org?.goal_system_mode ?? 'ote') as GoalSystemModeRaw;
  if (raw === 'simple') return 'simple_goals';
  if (raw === 'standard_commission') return 'standard_commission';
  return 'full_ote';
}

export const isFullOteMode = (m: ResultsMode) => m === 'full_ote';
export const isSimpleGoalsMode = (m: ResultsMode) => m === 'simple_goals';
export const isStandardCommissionMode = (m: ResultsMode) => m === 'standard_commission';

export interface ResultsCopy {
  pageTitle: string;
  pageSubtitle: string;
  badgeLabel: string;
  emptyState: string;
}

export function getResultsCopy(mode: ResultsMode): ResultsCopy {
  switch (mode) {
    case 'simple_goals':
      return {
        pageTitle: 'Relatório de Metas',
        pageSubtitle: 'Acompanhamento de metas comerciais',
        badgeLabel: 'Metas',
        emptyState: 'Nenhum vendedor com meta configurada neste período.',
      };
    case 'standard_commission':
      return {
        pageTitle: 'Relatório de Comissões',
        pageSubtitle: 'Comissões comerciais por venda, produto e vendedor',
        badgeLabel: 'Comissão',
        emptyState: 'Nenhuma comissão calculada neste período.',
      };
    case 'full_ote':
    default:
      return {
        pageTitle: 'Relatório OTE',
        pageSubtitle: 'OTE, metas, aceleradores e variável final',
        badgeLabel: 'OTE',
        emptyState: 'Clique em "Calcular" para gerar o relatório do período.',
      };
  }
}

/**
 * Labels executivos para as Flags de performance.
 * Cores e conceito permanecem; apenas o nome muda para leitura por gestores.
 */
export const FLAG_LABELS = {
  blue: 'Alta performance',
  yellow: 'Zona de atenção',
  red: 'Abaixo do mínimo',
} as const;
