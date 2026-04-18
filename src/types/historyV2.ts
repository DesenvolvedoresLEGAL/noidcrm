/**
 * Sprint 2.3 — Tipos canônicos da camada de histórico real.
 *
 * Estes tipos refletem as 3 tabelas históricas + views agregadoras
 * criadas na migration de Sprint 2.3. Não devem ser editados ad-hoc
 * pelas telas — são contrato compartilhado.
 */

export interface StageHistoryEntry {
  id: string;
  organization_id: string;
  opportunity_id: string;
  pipeline_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_by_user_id: string | null;
  changed_at: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface OwnerHistoryEntry {
  id: string;
  organization_id: string;
  opportunity_id: string;
  from_owner_user_id: string | null;
  to_owner_user_id: string | null;
  changed_by_user_id: string | null;
  changed_at: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface QualificationHistoryEntry {
  id: string;
  organization_id: string;
  opportunity_id: string;
  qualified_by_user_id: string | null;
  qualification_at: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface StageAgeV2 {
  opportunity_id: string;
  organization_id: string;
  current_stage_id: string | null;
  entered_current_stage_at: string | null;
  hours_in_current_stage: number | null;
  days_in_current_stage: number | null;
}

export interface FirstQualificationV2 {
  opportunity_id: string;
  organization_id: string;
  first_qualified_by_user_id: string | null;
  first_qualification_at: string | null;
  source: string | null;
}

export interface HistoryCoverageV2 {
  organization_id: string;
  total_opportunities: number;
  with_stage_history: number;
  with_owner_history: number;
  with_qualification_history: number;
  stage_history_coverage_pct: number;
  owner_history_coverage_pct: number;
  qualification_history_coverage_pct: number;
}
