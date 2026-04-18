/**
 * Sprint 2.1 — Auditoria técnica dos 14 relatórios atuais.
 *
 * Classificação:
 * - LEGACY_UNSAFE         → contém divergências graves de fonte de verdade
 * - LEGACY_PARTIALLY_SAFE → parcialmente correto, ainda usa fonte mista
 * - V2_READY              → migrado para views/edge functions canônicas V2
 *
 * Esta é a fonte única consultada por wrappers futuros para decidir se exibem
 * banner "Em validação" ou "Fonte canônica V2".
 */

export type ReportAuditStatus =
  | 'LEGACY_UNSAFE'
  | 'LEGACY_PARTIALLY_SAFE'
  | 'V2_READY';

export interface ReportAuditEntry {
  key: string;
  label: string;
  status: ReportAuditStatus;
  notes?: string;
}

export const REPORTS_AUDIT_STATUS: Record<string, ReportAuditEntry> = {
  general: {
    key: 'general',
    label: 'Visão Geral',
    status: 'LEGACY_UNSAFE',
    notes: 'Não filtra deleted_at em todos os caminhos; usa created_at como proxy de fechamento.',
  },
  'lost-reasons': {
    key: 'lost-reasons',
    label: 'Motivos de Perda',
    status: 'LEGACY_UNSAFE',
    notes: 'Mistura loss_reason_id e client_loss_reason_id sem normalização.',
  },
  forecast: {
    key: 'forecast',
    label: 'Forecast de Receita',
    status: 'LEGACY_UNSAFE',
    notes: 'Sprint 2.1 removeu meta hardcoded; ainda falta usar pipeline primário e is_primary.',
  },
  'closer-performance': {
    key: 'closer-performance',
    label: 'Performance Closer',
    status: 'LEGACY_UNSAFE',
    notes: 'Métricas vêm de view legada sem garantias de soft-delete.',
  },
  'team-performance': {
    key: 'team-performance',
    label: 'Performance Equipe',
    status: 'LEGACY_UNSAFE',
    notes: 'Agregação cliente-side por owner_user_id; sem materialização canônica.',
  },
  processed: {
    key: 'processed',
    label: 'Oportunidades Processadas',
    status: 'LEGACY_PARTIALLY_SAFE',
    notes: 'Filtra deleted_at, mas usa updated_at como aproximação de processamento.',
  },
  accumulated: {
    key: 'accumulated',
    label: 'Oportunidades Acumuladas',
    status: 'LEGACY_PARTIALLY_SAFE',
    notes: 'Filtra deleted_at; recorte temporal por created_at é parcialmente válido.',
  },
  origins: {
    key: 'origins',
    label: 'Origens',
    status: 'LEGACY_UNSAFE',
    notes: 'Sem normalização canônica de origem; valores divergem entre relatórios.',
  },
  'funnel-balance': {
    key: 'funnel-balance',
    label: 'Balanceamento de Funil',
    status: 'LEGACY_UNSAFE',
    notes: 'Sprint 2.1 removeu Math.random(); ainda depende de stage_history (Sprint 2.2).',
  },
  'conversion-rate': {
    key: 'conversion-rate',
    label: 'Taxa de Conversão',
    status: 'LEGACY_UNSAFE',
    notes: 'Definição de "conversão" não unificada; varia por consulta.',
  },
  'stage-conversion': {
    key: 'stage-conversion',
    label: 'Conversão por Estágio',
    status: 'LEGACY_UNSAFE',
    notes: 'Requer stage_history para apurar permanência e conversão real.',
  },
  'sdr-performance': {
    key: 'sdr-performance',
    label: 'Performance SDR',
    status: 'LEGACY_UNSAFE',
    notes: 'avg_qualification_hours não tem fonte estruturada.',
  },
  handoff: {
    key: 'handoff',
    label: 'Handoff',
    status: 'LEGACY_UNSAFE',
    notes: 'Cálculos dependem de stage_history e marcação de qualificação.',
  },
  'ai-insights': {
    key: 'ai-insights',
    label: 'Insights IA',
    status: 'LEGACY_UNSAFE',
    notes: 'Painel ainda consome dados não canonizados.',
  },
};

export function getReportAuditStatus(key: string): ReportAuditEntry | null {
  return REPORTS_AUDIT_STATUS[key] ?? null;
}

export function isReportV2Ready(key: string): boolean {
  return REPORTS_AUDIT_STATUS[key]?.status === 'V2_READY';
}

/**
 * Sprint 2.2 — Camada monetária canônica.
 *
 * Indica, por relatório, se o eixo MONETÁRIO já pode ser servido pela view
 * `v_opportunity_amounts_v2` (hook `useOpportunityAmountsV2`).
 *
 * Um relatório pode ter `monetaryLayer: 'V2_READY'` mesmo continuando como
 * `LEGACY_UNSAFE` no eixo geral — isso significa que pelo menos seus números
 * de receita/ticket podem ser migrados sem esperar Sprint 2.3+.
 */
export type MonetaryLayerStatus = 'V2_READY' | 'PENDING_DEPENDENCY' | 'NOT_APPLICABLE';

export const REPORTS_MONETARY_LAYER: Record<string, MonetaryLayerStatus> = {
  general: 'V2_READY',
  'lost-reasons': 'V2_READY',
  forecast: 'V2_READY',
  'closer-performance': 'V2_READY',
  'team-performance': 'V2_READY',
  processed: 'V2_READY',
  accumulated: 'V2_READY',
  origins: 'V2_READY',
  'funnel-balance': 'PENDING_DEPENDENCY', // requer stage_history
  'conversion-rate': 'PENDING_DEPENDENCY',
  'stage-conversion': 'PENDING_DEPENDENCY',
  'sdr-performance': 'V2_READY',
  handoff: 'PENDING_DEPENDENCY',
  'ai-insights': 'PENDING_DEPENDENCY',
};

export function getMonetaryLayerStatus(key: string): MonetaryLayerStatus {
  return REPORTS_MONETARY_LAYER[key] ?? 'NOT_APPLICABLE';
}

/**
 * Sprint 2.3 — Camada histórica canônica.
 *
 * Indica, por relatório, se as métricas TEMPORAIS (tempo por estágio,
 * tempo até qualificação, ciclo, handoff) já podem ser servidas pelas
 * views `v_opportunity_stage_age_v2`, `v_opportunity_first_qualification_v2`,
 * `v_opportunity_first_owner_v2` e `v_opportunity_current_owner_v2`.
 *
 * Mesmo `V2_READY` aqui, oportunidades antigas terão cobertura limitada
 * pelo backfill conservador (apenas evento inicial). Cobertura plena se
 * acumula a partir de novas mudanças após Sprint 2.3.
 */
export type HistoryLayerStatus = 'V2_READY' | 'PENDING_DEPENDENCY' | 'NOT_APPLICABLE';

export const REPORTS_HISTORY_LAYER: Record<string, HistoryLayerStatus> = {
  general: 'NOT_APPLICABLE',
  'lost-reasons': 'NOT_APPLICABLE',
  forecast: 'NOT_APPLICABLE',
  'closer-performance': 'V2_READY',
  'team-performance': 'V2_READY',
  processed: 'NOT_APPLICABLE',
  accumulated: 'NOT_APPLICABLE',
  origins: 'NOT_APPLICABLE',
  'funnel-balance': 'V2_READY',
  'conversion-rate': 'V2_READY',
  'stage-conversion': 'V2_READY',
  'sdr-performance': 'V2_READY',
  handoff: 'V2_READY',
  'ai-insights': 'PENDING_DEPENDENCY',
};

export function getHistoryLayerStatus(key: string): HistoryLayerStatus {
  return REPORTS_HISTORY_LAYER[key] ?? 'NOT_APPLICABLE';
}

/**
 * Sprint 2.4 — Camada de inteligência de perdas canônica.
 *
 * Indica, por relatório, se as métricas de PERDAS (motivo do vendedor,
 * motivo do cliente, registros win/loss, cobertura de classificação)
 * já podem ser servidas pelas views `v_loss_classification_v2`,
 * `v_lost_deals_v2`, `v_lost_deals_amounts_v2`,
 * `v_loss_classification_coverage_v2` e `v_loss_reason_rollup_v2`.
 */
export type LossLayerStatus = 'V2_READY' | 'PENDING_DEPENDENCY' | 'NOT_APPLICABLE';

export const REPORTS_LOSS_LAYER: Record<string, LossLayerStatus> = {
  general: 'NOT_APPLICABLE',
  'lost-reasons': 'V2_READY',
  forecast: 'NOT_APPLICABLE',
  'closer-performance': 'NOT_APPLICABLE',
  'team-performance': 'NOT_APPLICABLE',
  processed: 'NOT_APPLICABLE',
  accumulated: 'NOT_APPLICABLE',
  origins: 'NOT_APPLICABLE',
  'funnel-balance': 'NOT_APPLICABLE',
  'conversion-rate': 'NOT_APPLICABLE',
  'stage-conversion': 'NOT_APPLICABLE',
  'sdr-performance': 'NOT_APPLICABLE',
  handoff: 'NOT_APPLICABLE',
  'ai-insights': 'PENDING_DEPENDENCY',
  // Win/Loss Hub (módulo Inteligência) também consome esta camada
  'win-loss-hub': 'V2_READY',
  'lost-deals': 'V2_READY',
};

export function getLossLayerStatus(key: string): LossLayerStatus {
  return REPORTS_LOSS_LAYER[key] ?? 'NOT_APPLICABLE';
}

/**
 * Sprint 2.5 — Mapeamento canônico relatório → view V2.
 *
 * Cada relatório do CRM passa a ter uma view SQL oficial que serve como
 * única fonte de verdade. Hooks `useReport*V2` consomem estas views.
 */
export const REPORTS_CANONICAL_VIEW: Record<string, string> = {
  general: 'v_report_summary_v2',
  processed: 'v_report_processed_v2',
  'lost-reasons': 'v_report_losses_v2',
  'lost-deals': 'v_report_losses_detail_v2',
  origins: 'v_report_origins_v2',
  forecast: 'v_report_forecast_v2',
  'team-performance': 'v_report_team_v2',
  'closer-performance': 'v_report_closer_v2',
  'sdr-performance': 'v_report_sdr_v2',
  handoff: 'v_report_handoff_v2',
  'funnel-balance': 'v_report_stage_balance_v2',
  'stage-conversion': 'v_report_stage_conversion_v2',
  'conversion-rate': 'v_report_stage_conversion_v2',
  accumulated: 'v_report_accumulated_v2',
};

export function getCanonicalReportView(key: string): string | null {
  return REPORTS_CANONICAL_VIEW[key] ?? null;
}

/**
 * Sprint 2.6 — Mapeamento canônico relatório → edge function V2.
 *
 * Cada relatório passa a ter uma edge function oficial que envelopa a view V2
 * com auth, filtros canônicos, paginação, confidence e debug controlado.
 * Hooks futuros (Sprint 6) consumirão estas funções via `callReportEdgeFunction`.
 */
export const REPORTS_EDGE_FUNCTION: Record<string, string> = {
  general: 'report_summary_v2',
  processed: 'report_processed_v2',
  'lost-reasons': 'report_losses_v2',
  'lost-deals': 'report_losses_detail_v2',
  origins: 'report_origins_v2',
  forecast: 'report_forecast_v2',
  'team-performance': 'report_team_v2',
  'closer-performance': 'report_closer_v2',
  'sdr-performance': 'report_sdr_v2',
  handoff: 'report_handoff_v2',
  'funnel-balance': 'report_stage_balance_v2',
  'stage-conversion': 'report_stage_conversion_v2',
  'conversion-rate': 'report_stage_conversion_v2',
  accumulated: 'report_accumulated_v2',
  reconcile: 'report_reconcile_v2',
};

export function getCanonicalReportEdgeFunction(key: string): string | null {
  return REPORTS_EDGE_FUNCTION[key] ?? null;
}

/**
 * Sprint 2.7 — Telas migradas para UI V2 (Fase 1).
 *
 * Quando a flag `reports_v2_enabled` está ligada (master + sub),
 * estas telas passam a renderizar via wrappers V2 que consomem
 * exclusivamente as edge functions canônicas Sprint 2.6.
 */
export const REPORTS_UI_V2_PHASE_1 = new Set<string>([
  'general',
  'lost-reasons',
  'forecast',
  'closer-performance',
  'team-performance',
]);

export function isReportUiV2Phase1(key: string): boolean {
  return REPORTS_UI_V2_PHASE_1.has(key);
}
