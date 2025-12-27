import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, ArrowRight, TrendingUp, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { OpportunityWithScore } from '@/hooks/useOpportunityScoreAnalytics';

interface OpportunityScoreInsightsProps {
  opportunities: OpportunityWithScore[];
  kpis: {
    totalOpportunities: number;
    highScore: number;
    lowScore: number;
    highRisk: number;
    averageWinProbability: number;
  };
  isLoading: boolean;
}

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  tag: string;
}

export function OpportunityScoreInsights({ opportunities, kpis, isLoading }: OpportunityScoreInsightsProps) {
  const insights = useMemo<Insight[]>(() => {
    if (!opportunities || opportunities.length === 0) return [];

    const result: Insight[] = [];

    // High win probability deals
    const highWinProb = opportunities.filter(o => (o.win_probability_ai || 0) >= 80);
    if (highWinProb.length > 0) {
      result.push({
        id: 'high-win',
        icon: Sparkles,
        iconColor: 'text-green-500',
        title: `${highWinProb.length} oportunidades com alta chance de fechar`,
        description: 'AI Win Probability ≥ 80%. Priorize o fechamento dessas oportunidades!',
        tag: 'Prioridade',
      });
    }

    // Low score but high value
    const lowScoreHighValue = opportunities.filter(o => (o.opportunity_score || 0) < 40 && (o.valor_previsto || 0) > 50000);
    if (lowScoreHighValue.length > 0) {
      result.push({
        id: 'low-score-high-value',
        icon: AlertTriangle,
        iconColor: 'text-orange-500',
        title: `${lowScoreHighValue.length} deals de alto valor com score baixo`,
        description: 'Oportunidades valiosas precisam de atenção urgente para melhorar engagement.',
        tag: 'Atenção',
      });
    }

    // High risk deals
    if (kpis.highRisk > 0) {
      const riskPercent = Math.round((kpis.highRisk / kpis.totalOpportunities) * 100);
      result.push({
        id: 'high-risk',
        icon: AlertTriangle,
        iconColor: 'text-red-500',
        title: `${riskPercent}% do pipeline em alto risco`,
        description: 'Revise atividades, próximos passos e stakeholders envolvidos.',
        tag: 'Risco',
      });
    }

    // Strong velocity
    const highVelocity = opportunities.filter(o => (o.velocity_score || 0) >= 80);
    if (highVelocity.length >= 3) {
      result.push({
        id: 'high-velocity',
        icon: TrendingUp,
        iconColor: 'text-blue-500',
        title: `${highVelocity.length} deals com velocidade alta`,
        description: 'Oportunidades avançando rapidamente no funil. Mantenha o momentum!',
        tag: 'Positivo',
      });
    }

    // Low engagement
    const lowEngagement = opportunities.filter(o => (o.engagement_score || 0) < 30);
    if (lowEngagement.length >= 5) {
      result.push({
        id: 'low-engagement',
        icon: Clock,
        iconColor: 'text-yellow-500',
        title: `${lowEngagement.length} deals com baixo engajamento`,
        description: 'Aumentar atividades e touchpoints pode melhorar a chance de fechamento.',
        tag: 'Ação',
      });
    }

    return result.slice(0, 4);
  }, [opportunities, kpis]);

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insights de Opportunity Score
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3 mr-1" />
            AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Adicione mais oportunidades para gerar insights</div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const Icon = insight.icon;
              return (
                <div key={insight.id} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${insight.iconColor}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{insight.title}</span>
                        <Badge variant="outline" className="text-xs">{insight.tag}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
