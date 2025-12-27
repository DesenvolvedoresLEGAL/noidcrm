// NRHS Issue Definitions and CTA Configuration

export type IssueSeverity = 'high' | 'med' | 'low';
export type IssuePillar = 'integrity' | 'cadence' | 'stakeholders' | 'winloss' | 'adherence';

export interface NRHSIssue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  pillar: IssuePillar;
  blocker: boolean;
  cta: {
    type: 'edit_field' | 'create_activity' | 'edit_activity' | 'add_contact' | 'mark_review' | 'open_modal';
    target: string;
    label: string;
  };
}

export const NRHS_ISSUES: Record<string, NRHSIssue> = {
  // Integrity Issues
  missing_value: {
    id: 'missing_value',
    title: 'Valor não informado',
    description: 'O valor da oportunidade não foi preenchido, impossibilitando previsões de receita.',
    severity: 'high',
    pillar: 'integrity',
    blocker: true,
    cta: { type: 'edit_field', target: 'valor_previsto', label: 'Informar valor' }
  },
  missing_close_date: {
    id: 'missing_close_date',
    title: 'Data de fechamento ausente',
    description: 'Sem data prevista de fechamento, o forecast fica comprometido.',
    severity: 'high',
    pillar: 'integrity',
    blocker: true,
    cta: { type: 'edit_field', target: 'close_date_prevista', label: 'Definir data' }
  },
  stale_close_date: {
    id: 'stale_close_date',
    title: 'Data de fechamento vencida',
    description: 'A data de fechamento já passou e não foi atualizada recentemente.',
    severity: 'med',
    pillar: 'integrity',
    blocker: false,
    cta: { type: 'edit_field', target: 'close_date_prevista', label: 'Atualizar data' }
  },

  // Cadence Issues
  no_next_step: {
    id: 'no_next_step',
    title: 'Sem próximo passo',
    description: 'Nenhuma atividade futura agendada para esta oportunidade.',
    severity: 'high',
    pillar: 'cadence',
    blocker: true,
    cta: { type: 'create_activity', target: 'new_activity', label: 'Agendar atividade' }
  },
  next_step_overdue: {
    id: 'next_step_overdue',
    title: 'Próximo passo atrasado',
    description: 'A próxima atividade está fora do SLA esperado para o estágio atual.',
    severity: 'med',
    pillar: 'cadence',
    blocker: false,
    cta: { type: 'create_activity', target: 'new_activity', label: 'Agendar atividade' }
  },
  next_step_no_purpose: {
    id: 'next_step_no_purpose',
    title: 'Próximo passo sem propósito',
    description: 'A próxima atividade não tem descrição clara do objetivo.',
    severity: 'low',
    pillar: 'cadence',
    blocker: false,
    cta: { type: 'edit_activity', target: 'edit_activity', label: 'Adicionar propósito' }
  },

  // Stakeholder Issues
  single_contact: {
    id: 'single_contact',
    title: 'Contato único',
    description: 'Apenas um contato vinculado. Recomendamos mapear mais stakeholders.',
    severity: 'low',
    pillar: 'stakeholders',
    blocker: false,
    cta: { type: 'add_contact', target: 'contacts', label: 'Adicionar contato' }
  },
  no_decisor: {
    id: 'no_decisor',
    title: 'Decisor não identificado',
    description: 'Nenhum contato foi marcado como decisor nesta oportunidade.',
    severity: 'high',
    pillar: 'stakeholders',
    blocker: true,
    cta: { type: 'add_contact', target: 'contacts', label: 'Identificar decisor' }
  },
  no_champion: {
    id: 'no_champion',
    title: 'Champion não identificado',
    description: 'Nenhum contato interno defensor do negócio foi identificado.',
    severity: 'med',
    pillar: 'stakeholders',
    blocker: false,
    cta: { type: 'add_contact', target: 'contacts', label: 'Identificar champion' }
  },

  // Win/Loss Issues
  missing_lost_reason: {
    id: 'missing_lost_reason',
    title: 'Motivo de perda ausente',
    description: 'Oportunidade perdida sem registro do motivo.',
    severity: 'high',
    pillar: 'winloss',
    blocker: true,
    cta: { type: 'open_modal', target: 'lost_reason', label: 'Registrar motivo' }
  },
  lost_reason_not_informed: {
    id: 'lost_reason_not_informed',
    title: 'Motivo de perda genérico',
    description: 'Motivo de perda marcado como "Não informado" não gera aprendizado.',
    severity: 'high',
    pillar: 'winloss',
    blocker: true,
    cta: { type: 'open_modal', target: 'lost_reason', label: 'Detalhar motivo' }
  },
  lost_reason_no_detail: {
    id: 'lost_reason_no_detail',
    title: 'Motivo de perda sem detalhes',
    description: 'O detalhamento do motivo de perda é muito curto para gerar insights.',
    severity: 'med',
    pillar: 'winloss',
    blocker: false,
    cta: { type: 'open_modal', target: 'lost_reason', label: 'Adicionar detalhes' }
  },

  // Adherence Issues
  no_weekly_review: {
    id: 'no_weekly_review',
    title: 'Sem revisão semanal',
    description: 'Esta oportunidade não foi revisada nos últimos 7 dias.',
    severity: 'med',
    pillar: 'adherence',
    blocker: false,
    cta: { type: 'mark_review', target: 'weekly_review', label: 'Marcar revisão' }
  },
  stage_status_mismatch: {
    id: 'stage_status_mismatch',
    title: 'Estágio inconsistente',
    description: 'O estágio atual não condiz com o status da oportunidade.',
    severity: 'med',
    pillar: 'adherence',
    blocker: false,
    cta: { type: 'edit_field', target: 'stage_id', label: 'Corrigir estágio' }
  }
};

// Get ordered issues by severity and impact
export function getOrderedIssues(issueIds: string[]): NRHSIssue[] {
  const issues = issueIds.map(id => NRHS_ISSUES[id]).filter(Boolean);
  
  return issues.sort((a, b) => {
    // Blockers first
    if (a.blocker && !b.blocker) return -1;
    if (!a.blocker && b.blocker) return 1;
    
    // Then by severity
    const severityOrder: Record<IssueSeverity, number> = { high: 0, med: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// Get blockers only
export function getBlockerIssues(issueIds: string[]): NRHSIssue[] {
  return issueIds
    .map(id => NRHS_ISSUES[id])
    .filter(issue => issue?.blocker);
}
