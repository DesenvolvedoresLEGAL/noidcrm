import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, ArrowRight, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { LeadWithScore, LeadScoreFilters } from '@/hooks/useLeadScoreAnalytics';

interface LeadScoreInsightsProps {
  leads: LeadWithScore[];
  kpis: {
    totalLeads: number;
    gradeA: number;
    gradeB: number;
    gradeC: number;
    gradeD: number;
    gradeF: number;
    averageFit: number;
    averageIntent: number;
  };
  isLoading: boolean;
  setFilters?: (filters: LeadScoreFilters | ((prev: LeadScoreFilters) => LeadScoreFilters)) => void;
}

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  tag: string;
  priority: 'high' | 'medium' | 'low';
  apply: () => LeadScoreFilters;
}

export function LeadScoreInsights({ leads, kpis, isLoading, setFilters }: LeadScoreInsightsProps) {
  const insights = useMemo<Insight[]>(() => {
    if (!leads || leads.length === 0) return [];

    const result: Insight[] = [];

    const gradeALeads = leads.filter((l) => l.lead_grade === 'A');
    if (gradeALeads.length > 0) {
      result.push({
        id: 'hot-leads',
        icon: Sparkles,
        iconColor: 'text-green-500',
        title: `${gradeALeads.length} leads quentes disponíveis`,
        description: 'Leads Grade A têm alta probabilidade de conversão. Priorize contato imediato!',
        tag: 'Prioridade',
        priority: 'high',
        apply: () => ({ grade: 'A' }),
      });
    }

    const lowFitHighIntent = leads.filter(
      (l) => (l.fit_score || 0) < 50 && (l.intent_score || 0) >= 70
    );
    if (lowFitHighIntent.length > 0) {
      result.push({
        id: 'low-fit-high-intent',
        icon: TrendingUp,
        iconColor: 'text-blue-500',
        title: `${lowFitHighIntent.length} leads com alto interesse`,
        description: 'Leads com baixo FIT mas alto INTENT. Valide o perfil antes de investir esforço.',
        tag: 'Atenção',
        priority: 'medium',
        apply: () => ({ custom: 'low_fit_high_intent' }),
      });
    }

    const coldLeads = leads.filter((l) => l.lead_grade === 'D' || l.lead_grade === 'F');
    const coldPercent = leads.length > 0 ? Math.round((coldLeads.length / leads.length) * 100) : 0;
    if (coldPercent > 30) {
      result.push({
        id: 'cold-leads',
        icon: AlertTriangle,
        iconColor: 'text-orange-500',
        title: `${coldPercent}% dos leads estão frios`,
        description: 'Alta proporção de leads D/F. Considere campanhas de reativação ou limpeza da base.',
        tag: 'Qualidade',
        priority: 'medium',
        apply: () => ({ grades: ['D', 'F'] }),
      });
    }

    if (kpis.averageIntent > kpis.averageFit + 15) {
      result.push({
        id: 'intent-over-fit',
        icon: TrendingUp,
        iconColor: 'text-purple-500',
        title: 'Engajamento supera perfil ideal',
        description:
          'INTENT médio está acima do FIT. Leads engajados podem não ter perfil ideal. Revise critérios de FIT.',
        tag: 'Estratégia',
        priority: 'low',
        apply: () => ({ custom: 'low_fit_high_intent' }),
      });
    }

    const gradeBLeads = leads.filter((l) => l.lead_grade === 'B');
    if (gradeBLeads.length > 5) {
      result.push({
        id: 'grade-b-potential',
        icon: Lightbulb,
        iconColor: 'text-yellow-500',
        title: `${gradeBLeads.length} leads prontos para nutrição`,
        description: 'Leads Grade B estão a um passo de se tornarem quentes. Invista em conteúdo direcionado.',
        tag: 'Oportunidade',
        priority: 'medium',
        apply: () => ({ grade: 'B' }),
      });
    }

    return result.slice(0, 4);
  }, [leads, kpis]);

  const handleInsightClick = (insight: Insight) => {
    if (!setFilters) return;
    setFilters(insight.apply());
    // Scroll into the table
    requestAnimationFrame(() => {
      const el = document.getElementById('lead-score-table');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insights de Lead Score
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3 mr-1" />
            AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Adicione mais leads para gerar insights automáticos
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const Icon = insight.icon;
              return (
                <button
                  key={insight.id}
                  type="button"
                  onClick={() => handleInsightClick(insight)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/40 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${insight.iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm">{insight.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.tag}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                      <p className="text-[11px] text-primary mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Clique para filtrar a lista →
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
