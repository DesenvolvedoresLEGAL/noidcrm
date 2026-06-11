/**
 * Sprint RCC V3.9 — Auditoria de migração do consumo executivo para o
 * Revenue Command Center. Catálogo estático somente leitura: nenhuma view,
 * tabela, edge function ou regra é alterada por este hook.
 */
import { useMemo } from 'react';

export type MigrationStatus = 'migrated' | 'partial' | 'not_migrated';

export interface MigrationEntry {
  id: string;
  legacyLabel: string;
  legacyRoute: string;
  rccTab: string;
  rccRoute: string;
  status: MigrationStatus;
  notes?: string;
  /** Pode ser ocultada da navegação principal sem perder dados? */
  hideFromMenu: boolean;
}

export interface DependencyEntry {
  rccTab: string;
  sources: string[];
}

export interface DuplicateMetric {
  metric: string;
  locations: string[];
}

export interface MigrationAuditData {
  migrated: MigrationEntry[];
  partial: MigrationEntry[];
  notMigrated: MigrationEntry[];
  all: MigrationEntry[];
  dependencies: DependencyEntry[];
  duplicates: DuplicateMetric[];
  meta: {
    generatedAt: string;
    totals: { migrated: number; partial: number; notMigrated: number };
  };
}

const ENTRIES: MigrationEntry[] = [
  {
    id: 'forecast',
    legacyLabel: 'Forecast',
    legacyRoute: '/app/forecast',
    rccTab: 'Hoje na Operação · Riscos · Pipeline Health',
    rccRoute: '/app/revenue-command',
    status: 'migrated',
    notes: 'Meta, cenários e qualidade já consumidos pelo RCC.',
    hideFromMenu: true,
  },
  {
    id: 'desempenho',
    legacyLabel: 'Desempenho (SDR/Closer/Handoff)',
    legacyRoute: '/app/objetivos/desempenho',
    rccTab: 'Pessoas',
    rccRoute: '/app/revenue-command',
    status: 'migrated',
    notes: 'Síntese executiva por SDR/Closer no RCC. Detalhe operacional segue na tela original.',
    hideFromMenu: true,
  },
  {
    id: 'winloss',
    legacyLabel: 'Win/Loss Hub',
    legacyRoute: '/app/intelligence/winloss',
    rccTab: 'Gargalos · Riscos',
    rccRoute: '/app/revenue-command',
    status: 'partial',
    notes: 'Sinais principais já presentes. Visão analítica completa permanece no hub.',
    hideFromMenu: false,
  },
  {
    id: 'pipeline_health_legacy',
    legacyLabel: 'Pipeline Health (cards antigos)',
    legacyRoute: '/app/forecast',
    rccTab: 'Pipeline Health',
    rccRoute: '/app/revenue-command',
    status: 'migrated',
    notes: 'CRM Trust Score, issues e money at risk consolidados no RCC.',
    hideFromMenu: true,
  },
  {
    id: 'qualidade',
    legacyLabel: 'Qualidade de Qualificação',
    legacyRoute: '/app/objetivos/desempenho',
    rccTab: 'Pessoas · Gargalos',
    rccRoute: '/app/revenue-command',
    status: 'partial',
    notes: 'Métricas SDR no RCC; drilldown operacional segue no relatório.',
    hideFromMenu: false,
  },
  {
    id: 'auditoria',
    legacyLabel: 'Auditoria / Resultados',
    legacyRoute: '/app/reports/ote',
    rccTab: 'Health & Trust',
    rccRoute: '/app/revenue-command',
    status: 'partial',
    notes: 'Trust score executivo no RCC; relatório detalhado mantém-se como fonte operacional.',
    hideFromMenu: false,
  },
  {
    id: 'ote',
    legacyLabel: 'OTE / Resultados',
    legacyRoute: '/app/reports/ote',
    rccTab: 'Pessoas · Próximas Ações',
    rccRoute: '/app/revenue-command',
    status: 'not_migrated',
    notes: 'Detalhamento de comissão e ciclos OTE ainda exclusivos da tela original.',
    hideFromMenu: false,
  },
];

const DEPENDENCIES: DependencyEntry[] = [
  { rccTab: 'Hoje na Operação', sources: ['Forecast', 'Resultados', 'Desempenho', 'Win/Loss', 'Qualidade Qualif.'] },
  { rccTab: 'Gargalos',         sources: ['Qualidade', 'Win/Loss', 'Resultados/Auditoria', 'Forecast', 'Propostas'] },
  { rccTab: 'Pipeline Health',  sources: ['Pipeline de Vendas', 'CRM Trust'] },
  { rccTab: 'Pessoas',          sources: ['Desempenho SDR', 'Desempenho Closer', 'Receita por Vendedor', 'OTE'] },
  { rccTab: 'Riscos',           sources: ['Forecast', 'Pipeline de Vendas', 'Win/Loss', 'Receita', 'Qualidade', 'CRM Trust'] },
  { rccTab: 'Próximas Ações',   sources: ['Riscos', 'Pipeline Health', 'Gargalos'] },
  { rccTab: 'Health & Trust',   sources: ['Pipeline Health', 'Riscos', 'Gargalos', 'Hoje na Operação'] },
];

const DUPLICATES: DuplicateMetric[] = [
  { metric: 'Receita válida',  locations: ['Dashboard', 'Forecast', 'Desempenho', 'OTE', 'Win/Loss', 'Revenue Command'] },
  { metric: 'Forecast',        locations: ['Forecast', 'Dashboard', 'Revenue Command', 'Risk Center'] },
  { metric: 'Conversão',       locations: ['Win/Loss', 'Desempenho', 'Pipeline', 'Revenue Command'] },
  { metric: 'Qualificação',    locations: ['Desempenho', 'Qualidade', 'Revenue Command'] },
  { metric: 'Perdas',          locations: ['Win/Loss Hub', 'Forecast', 'Revenue Command'] },
  { metric: 'Pipeline aberto', locations: ['Pipeline', 'Forecast', 'Revenue Command'] },
  { metric: 'CRM Trust Score', locations: ['Pipeline Health', 'Revenue Command'] },
  { metric: 'Meta',            locations: ['Forecast', 'Desempenho', 'OTE', 'Dashboard', 'Revenue Command'] },
];

export function useRevenueCommandMigrationAudit() {
  return useMemo<{ data: MigrationAuditData; isLoading: false; error: null }>(() => {
    const migrated = ENTRIES.filter((e) => e.status === 'migrated');
    const partial = ENTRIES.filter((e) => e.status === 'partial');
    const notMigrated = ENTRIES.filter((e) => e.status === 'not_migrated');
    return {
      data: {
        migrated,
        partial,
        notMigrated,
        all: ENTRIES,
        dependencies: DEPENDENCIES,
        duplicates: DUPLICATES,
        meta: {
          generatedAt: new Date().toISOString(),
          totals: {
            migrated: migrated.length,
            partial: partial.length,
            notMigrated: notMigrated.length,
          },
        },
      },
      isLoading: false,
      error: null,
    };
  }, []);
}

/** Lista de rotas legadas que devem ser ocultadas da navegação principal. */
export function getHiddenLegacyRoutes(): Set<string> {
  return new Set(ENTRIES.filter((e) => e.hideFromMenu).map((e) => e.legacyRoute));
}
