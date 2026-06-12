// Sprint 5 — Qualificação Comercial: próxima ação recomendada.
// Pure function. Same input -> same output.

import type { QualificationScoreResult } from './qualificationScore';

export interface QualificationRecommendation {
  title: string;
  description: string;
}

/**
 * Returns the next recommended action for a qualification opportunity,
 * based on the most impactful pending blocker (priority order) and the
 * current score tier.
 */
export function getQualificationRecommendation(
  result: QualificationScoreResult
): QualificationRecommendation {
  const blockers = new Set(result.blockers);

  // Ordered by commercial priority — most decisive gap first.
  if (blockers.has('Permissão real para proposta válida')) {
    return {
      title: 'Validar decisor e combinar próximo passo antes de enviar para Vendas',
      description:
        'O lead ainda não deu permissão clara para receber proposta. Confirme com o decisor e registre a permissão real antes do handoff.',
    };
  }

  if (blockers.has('Poder ou influência')) {
    return {
      title: 'Identificar o decisor real antes de avançar',
      description:
        'Mapeie quem decide ou influencia diretamente a compra para evitar perder o deal no fechamento.',
    };
  }

  if (blockers.has('Próximo passo combinado')) {
    return {
      title: 'Combinar próximo passo claro com o lead',
      description:
        'Defina uma ação concreta (reunião, validação de escopo ou orçamento) e registre no checklist.',
    };
  }

  if (
    blockers.has('Urgência real') ||
    blockers.has('Data do evento') ||
    blockers.has('Local do evento')
  ) {
    return {
      title: 'Mapear evento (data, local e urgência) para qualificar',
      description:
        'Sem data, local ou urgência definidos não é possível dimensionar o deal nem priorizar o atendimento.',
    };
  }

  if (
    blockers.has('Quantidade de conexões') ||
    blockers.has('Finalidade de uso') ||
    blockers.has('Nome do evento')
  ) {
    return {
      title: 'Detalhar a demanda técnica do evento',
      description:
        'Levante conexões simultâneas, equipamentos e finalidade de uso para sustentar a proposta comercial.',
    };
  }

  if (
    blockers.has('Nome da empresa') ||
    blockers.has('Nome do contato')
  ) {
    return {
      title: 'Cadastrar empresa e contato principal',
      description:
        'Sem empresa e contato vinculados a oportunidade não pode seguir para Vendas.',
    };
  }

  // No blockers — recommendation depends on score tier.
  if (result.canMoveToSales) {
    return {
      title: 'Lead pronto para Vendas',
      description:
        'Checklist completo e score acima de 75. Mova a oportunidade para o funil de Vendas.',
    };
  }

  if (result.total >= 60) {
    return {
      title: 'Reforçar pontos fracos do checklist para liberar handoff',
      description:
        'O lead está próximo do mínimo. Aprofunde os critérios com menor pontuação até atingir 75.',
    };
  }

  return {
    title: 'Lead ainda imaturo. Continuar descoberta antes de propor',
    description:
      'Score abaixo de 60. Aprofunde a descoberta de demanda, urgência e poder antes de avançar.',
  };
}
