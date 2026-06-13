// Sprint 1+ — Régua de Qualificação: tipos compartilhados
// Multi-tenant, configurável por organização.

export type QualificationFieldSource =
  | 'native_opportunity'
  | 'native_company'
  | 'native_contact'
  | 'custom_field'
  | 'form_field';

export type QualificationAutomationTrigger =
  | 'on_disqualify'
  | 'on_reach_minimum_score'
  | 'on_below_minimum_score'
  | 'on_classification_change';

export interface QualificationFieldOption {
  value: string;
  label: string;
  points?: number;
  valid_permission?: boolean;
}

export interface QualificationFramework {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  applies_to_pipeline_ids: string[];
  applies_to_stage_ids: string[];
  target_pipeline_id: string | null;
  minimum_score_to_advance: number;
  template_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface QualificationCriterion {
  id: string;
  framework_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  weight: number;
  order_index: number;
  is_required: boolean;
  is_active: boolean;
  criterion_key: string | null;
}

export interface QualificationCriterionField {
  id: string;
  framework_id: string;
  criterion_id: string;
  organization_id: string;
  field_source: QualificationFieldSource;
  field_key: string;
  field_label: string;
  field_type: string;
  points: number;
  is_required_for_score: boolean;
  is_required_for_advance: boolean;
  validation_type: string | null;
  invalid_values: string[];
  min_value: number | null;
  max_value: number | null;
  options: QualificationFieldOption[];
  order_index: number;
}

export interface QualificationScoreRange {
  id: string;
  framework_id: string;
  organization_id: string;
  label: string;
  range_key: string | null;
  min_score: number;
  max_score: number;
  color: string | null;
  description: string | null;
  is_sql: boolean;
  is_priority: boolean;
  order_index: number;
}

export interface QualificationBlockingRule {
  id: string;
  framework_id: string;
  organization_id: string;
  action_key: string;
  action_label: string;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  minimum_score: number | null;
  require_all_required_fields: boolean;
  require_valid_proposal_permission: boolean;
  block_message_title: string | null;
  block_message_body: string | null;
  is_active: boolean;
  order_index: number;
}

export interface QualificationDisqualificationReason {
  id: string;
  framework_id: string;
  organization_id: string;
  reason_label: string;
  reason_key: string;
  category: string | null;
  accountability: string | null;
  send_to_remarketing_default: boolean;
  is_active: boolean;
  order_index: number;
}

export interface QualificationAutomation {
  id: string;
  framework_id: string;
  organization_id: string;
  trigger_key: QualificationAutomationTrigger;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  order_index: number;
}

export interface QualificationFrameworkBundle {
  framework: QualificationFramework;
  criteria: QualificationCriterion[];
  fields: QualificationCriterionField[];
  ranges: QualificationScoreRange[];
  blockingRules: QualificationBlockingRule[];
  reasons: QualificationDisqualificationReason[];
  automations: QualificationAutomation[];
}
