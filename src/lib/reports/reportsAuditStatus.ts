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
