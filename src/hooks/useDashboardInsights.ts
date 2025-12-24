import { useMemo } from 'react';
import { formatCurrencyFull } from '@/lib/i18n';

export interface DashboardInsight {
  insight: string;
  impact: 'Alto' | 'Médio' | 'Baixo';
  confidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRepInsights(data: any): DashboardInsight[] {
  return useMemo(() => {
    if (!data) return [];
    
    const insights: DashboardInsight[] = [];
    
    // Pending tasks
    if (data.pendingTasks?.overdue > 0) {
      insights.push({
        insight: `${data.pendingTasks.overdue} tarefa(s) atrasada(s) - priorize para não perder oportunidades`,
        impact: 'Alto',
        confidence: 90
      });
    }
    
    // Pipeline value
    if (data.openOpportunities?.value > 0) {
      insights.push({
        insight: `Seu pipeline atual é de ${formatCurrencyFull(data.openOpportunities.value)} - foque nas oportunidades de maior valor`,
        impact: 'Médio',
        confidence: 85
      });
    }
    
    // At risk opportunities
    if (data.atRiskOpportunities?.length > 0) {
      insights.push({
        insight: `${data.atRiskOpportunities.length} oportunidade(s) em risco precisam de atenção urgente`,
        impact: 'Alto',
        confidence: 88
      });
    }
    
    // Hot leads
    if (data.hotLeads?.length > 0) {
      insights.push({
        insight: `${data.hotLeads.length} lead(s) quente(s) para você trabalhar hoje`,
        impact: 'Alto',
        confidence: 92
      });
    }
    
    // Monthly goal progress
    if (data.monthlyGoal?.percentage >= 80) {
      insights.push({
        insight: `Você está em ${data.monthlyGoal.percentage.toFixed(0)}% da meta - continue assim!`,
        impact: 'Médio',
        confidence: 95
      });
    } else if (data.monthlyGoal?.percentage < 50) {
      insights.push({
        insight: `Meta em ${data.monthlyGoal.percentage.toFixed(0)}% - intensifique as atividades`,
        impact: 'Alto',
        confidence: 85
      });
    }
    
    // Pending proposals
    if (data.pendingProposals?.length > 0) {
      insights.push({
        insight: `${data.pendingProposals.length} proposta(s) aguardando resposta - faça follow-up`,
        impact: 'Médio',
        confidence: 82
      });
    }
    
    return insights.slice(0, 4);
  }, [data]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useManagerInsights(data: any): DashboardInsight[] {
  return useMemo(() => {
    if (!data) return [];
    
    const insights: DashboardInsight[] = [];
    
    // Meta vs realizado
    if (data.teamGoal?.goal > 0) {
      const progress = data.teamGoal.percentage;
      if (progress >= 80) {
        insights.push({
          insight: `Equipe está em ${progress.toFixed(0)}% da meta - excelente performance!`,
          impact: 'Alto',
          confidence: 95
        });
      } else if (progress < 50) {
        insights.push({
          insight: `Apenas ${progress.toFixed(0)}% da meta atingida - ação urgente necessária`,
          impact: 'Alto',
          confidence: 92
        });
      }
    }
    
    // Pipeline aging
    const agingDeals = data.pipelineAging?.filter((p: any) => p.days > 30).length || 0;
    if (agingDeals > 0) {
      insights.push({
        insight: `${agingDeals} oportunidade(s) parada(s) há mais de 30 dias - revise com o time`,
        impact: 'Alto',
        confidence: 88
      });
    }
    
    // Loss reasons
    if (data.lossReasons && data.lossReasons.length > 0) {
      const topReason = data.lossReasons[0];
      insights.push({
        insight: `Principal motivo de perda: "${topReason.reason}" - considere treinar o time`,
        impact: 'Médio',
        confidence: 85
      });
    }
    
    // Behavior monitor
    const lowPerformers = data.behaviorMonitor?.filter((m: any) => m.score < 50).length || 0;
    if (lowPerformers > 0) {
      insights.push({
        insight: `${lowPerformers} vendedor(es) precisam de coaching - agende 1:1s`,
        impact: 'Médio',
        confidence: 80
      });
    }
    
    // Team size
    if (data.teamMembers && data.teamMembers.length > 0 && data.teamGoal?.achieved) {
      const avgRevenue = data.teamGoal.achieved / data.teamMembers.length;
      insights.push({
        insight: `Receita média por vendedor: ${formatCurrencyFull(avgRevenue)}`,
        impact: 'Baixo',
        confidence: 90
      });
    }
    
    return insights.slice(0, 4);
  }, [data]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAdminInsights(data: any): DashboardInsight[] {
  return useMemo(() => {
    if (!data) return [];
    
    const insights: DashboardInsight[] = [];
    
    // Data quality
    const qualityScore = data.dataQuality?.score || data.dataQuality?.percentage || 0;
    if (qualityScore < 80) {
      insights.push({
        insight: `Qualidade de dados em ${qualityScore}% - considere limpeza de base`,
        impact: 'Alto',
        confidence: 92
      });
    } else if (qualityScore >= 90) {
      insights.push({
        insight: `Qualidade de dados excelente (${qualityScore}%) - base bem mantida`,
        impact: 'Baixo',
        confidence: 95
      });
    }
    
    // Automation success rate
    if (data.automations?.successRate && data.automations.successRate < 90) {
      insights.push({
        insight: `Taxa de sucesso das automações em ${data.automations.successRate.toFixed(0)}% - revise fluxos com falhas`,
        impact: 'Alto',
        confidence: 88
      });
    }
    
    // Volts usage
    if (data.voltsUsage?.total > 0) {
      insights.push({
        insight: `${data.voltsUsage.total} Volts consumidos - monitore para evitar surpresas`,
        impact: 'Médio',
        confidence: 85
      });
    }
    
    // System usage
    if (data.systemUsage?.totalUsers > 0) {
      insights.push({
        insight: `${data.systemUsage.totalUsers} usuários ativos no sistema`,
        impact: 'Baixo',
        confidence: 98
      });
    }
    
    // Failures
    if (data.failureHistory?.length > 0) {
      const recentFailures = data.failureHistory.slice(0, 5).length;
      if (recentFailures > 0) {
        insights.push({
          insight: `${recentFailures} falha(s) recente(s) nas automações - verifique os logs`,
          impact: 'Alto',
          confidence: 90
        });
      }
    }
    
    return insights.slice(0, 4);
  }, [data]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFinanceInsights(data: any): DashboardInsight[] {
  return useMemo(() => {
    if (!data) return [];
    
    const insights: DashboardInsight[] = [];
    
    // Goal progress
    if (data.kpis?.goalProgress >= 80) {
      insights.push({
        insight: `Meta em ${data.kpis.goalProgress.toFixed(0)}% - projeção positiva para o mês`,
        impact: 'Alto',
        confidence: 90
      });
    } else if (data.kpis?.goalProgress < 50) {
      insights.push({
        insight: `Meta em apenas ${data.kpis.goalProgress.toFixed(0)}% - necessário acelerar vendas`,
        impact: 'Alto',
        confidence: 88
      });
    }
    
    // Pipeline ponderado
    if (data.kpis?.weightedPipeline > 0) {
      insights.push({
        insight: `Pipeline ponderado de ${formatCurrencyFull(data.kpis.weightedPipeline)} em projeção`,
        impact: 'Médio',
        confidence: 85
      });
    }
    
    // Propostas pendentes
    if (data.kpis?.pendingProposals > 0) {
      insights.push({
        insight: `${data.kpis.pendingProposals} proposta(s) aguardando aprovação`,
        impact: 'Médio',
        confidence: 95
      });
    }
    
    // Receita mensal
    if (data.kpis?.monthlyRevenue > 0) {
      insights.push({
        insight: `Receita consolidada do mês: ${formatCurrencyFull(data.kpis.monthlyRevenue)}`,
        impact: 'Baixo',
        confidence: 98
      });
    }
    
    // Forecast
    if (data.forecast?.realistic > 0) {
      insights.push({
        insight: `Forecast realista projeta ${formatCurrencyFull(data.forecast.realistic)}`,
        impact: 'Médio',
        confidence: 82
      });
    }
    
    return insights.slice(0, 4);
  }, [data]);
}
