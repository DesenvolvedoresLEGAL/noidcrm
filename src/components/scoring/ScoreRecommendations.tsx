import { useMemo } from 'react';
import { Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreRecommendationsProps {
  entityType: 'account' | 'opportunity';
  scores: {
    fitScore?: number | null;
    intentScore?: number | null;
    engagementScore?: number | null;
    velocityScore?: number | null;
    riskScore?: number | null;
    leadScore?: number | null;
    opportunityScore?: number | null;
  };
  scoringFactors?: Record<string, any> | null;
  className?: string;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
}

export function ScoreRecommendations({
  entityType,
  scores,
  scoringFactors,
  className,
}: ScoreRecommendationsProps) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];

    if (entityType === 'account') {
      // FIT Score recommendations
      if ((scores.fitScore ?? 0) < 50) {
        recs.push({
          id: 'fit-icp',
          priority: 'high',
          title: 'Melhorar aderência ao ICP',
          description: 'Valide se esta conta realmente se encaixa no perfil de cliente ideal. Verifique segmento, tamanho e região.',
          impact: '+15-25 pts FIT',
        });
      }

      // INTENT Score recommendations
      if ((scores.intentScore ?? 0) < 40) {
        recs.push({
          id: 'intent-activity',
          priority: 'high',
          title: 'Aumentar engajamento',
          description: 'Registre atividades recentes (ligações, emails, reuniões) para demonstrar interesse ativo.',
          impact: '+20-30 pts INTENT',
        });
      }

      if ((scores.intentScore ?? 0) < 60 && (scores.intentScore ?? 0) >= 40) {
        recs.push({
          id: 'intent-opportunity',
          priority: 'medium',
          title: 'Criar oportunidade',
          description: 'Converta o interesse em uma oportunidade formal no funil de vendas.',
          impact: '+15 pts INTENT',
        });
      }

      // General account recommendations
      if (!scoringFactors?.has_recent_activity) {
        recs.push({
          id: 'recent-contact',
          priority: 'medium',
          title: 'Fazer contato recente',
          description: 'Esta conta não tem atividades nos últimos 30 dias. Agende um follow-up.',
          impact: '+10 pts INTENT',
        });
      }

      if (!scoringFactors?.has_contact) {
        recs.push({
          id: 'add-contact',
          priority: 'low',
          title: 'Adicionar contato',
          description: 'Cadastre pelo menos um contato principal para facilitar a comunicação.',
          impact: '+5 pts FIT',
        });
      }
    } else {
      // Opportunity recommendations
      
      // Engagement recommendations
      if ((scores.engagementScore ?? 0) < 40) {
        recs.push({
          id: 'engagement-activities',
          priority: 'high',
          title: 'Aumentar atividades',
          description: 'Registre mais interações (reuniões, ligações, demos) para mostrar engajamento ativo.',
          impact: '+20-30 pts Engajamento',
        });
      }

      // Velocity recommendations
      if ((scores.velocityScore ?? 0) < 50) {
        recs.push({
          id: 'velocity-stage',
          priority: 'high',
          title: 'Avançar no funil',
          description: 'Esta oportunidade está estagnada. Identifique os bloqueadores e avance para o próximo estágio.',
          impact: '+15-25 pts Velocidade',
        });
      }

      // Risk recommendations
      if ((scores.riskScore ?? 0) >= 60) {
        recs.push({
          id: 'risk-stale',
          priority: 'high',
          title: 'Reduzir risco de perda',
          description: 'Oportunidade em alto risco. Faça contato urgente para reengajar o prospect.',
          impact: '-20 pts Risco',
        });
      }

      if ((scores.riskScore ?? 0) >= 40 && (scores.riskScore ?? 0) < 60) {
        recs.push({
          id: 'risk-medium',
          priority: 'medium',
          title: 'Monitorar sinais de risco',
          description: 'Verifique se há objeções não resolvidas ou concorrentes no processo.',
          impact: '-10 pts Risco',
        });
      }

      // Proposal recommendations
      if (!scoringFactors?.has_proposal) {
        recs.push({
          id: 'create-proposal',
          priority: 'medium',
          title: 'Enviar proposta',
          description: 'Crie e envie uma proposta comercial para formalizar a negociação.',
          impact: '+10 pts Engajamento',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [entityType, scores, scoringFactors]);

  if (recommendations.length === 0) {
    return (
      <div className={cn('p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30', className)}>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Score otimizado!</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Continue mantendo o engajamento para preservar a pontuação.
        </p>
      </div>
    );
  }

  const priorityColors = {
    high: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
    medium: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
    low: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
  };

  const priorityLabels = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span>Recomendações para melhorar score</span>
      </div>

      <div className="space-y-2">
        {recommendations.slice(0, 3).map((rec) => (
          <div
            key={rec.id}
            className={cn(
              'p-2.5 rounded-lg border-l-2 transition-colors',
              priorityColors[rec.priority]
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{rec.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    Prioridade {priorityLabels[rec.priority]}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {rec.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-primary font-medium shrink-0">
                <ArrowRight className="h-3 w-3" />
                {rec.impact}
              </div>
            </div>
          </div>
        ))}
      </div>

      {recommendations.length > 3 && (
        <p className="text-[10px] text-muted-foreground text-center">
          +{recommendations.length - 3} recomendações adicionais
        </p>
      )}
    </div>
  );
}
