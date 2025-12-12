import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Users,
  Target,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useDailyBriefing, DailyBriefing } from '@/hooks/useDailyBriefing';
import { cn } from '@/lib/utils';

interface AIBriefingCardProps {
  briefingType: 'owner' | 'manager' | 'sales';
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function BriefingContent({ briefing, type }: { briefing: DailyBriefing; type: string }) {
  const priorityColors = {
    high: 'bg-red-500/20 text-red-600 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
    low: 'bg-green-500/20 text-green-600 border-green-500/30'
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">{briefing.summary}</p>
      </div>

      {/* Priority Actions */}
      {briefing.priority_actions && briefing.priority_actions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Target className="h-3.5 w-3.5" />
            Ações Prioritárias
          </h4>
          <div className="space-y-2">
            {briefing.priority_actions.slice(0, 3).map((action, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <Badge 
                  variant="outline" 
                  className={cn('text-[10px] shrink-0', priorityColors[action.priority])}
                >
                  {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{action.reason}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type-specific content */}
      {type === 'owner' && briefing.strategic_recommendations && briefing.strategic_recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Recomendações Estratégicas
          </h4>
          <div className="grid gap-2">
            {briefing.strategic_recommendations.slice(0, 2).map((rec, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <Badge variant="outline" className="mb-1 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                  {rec.area}
                </Badge>
                <p className="text-sm text-muted-foreground">{rec.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'manager' && briefing.coaching_insights && briefing.coaching_insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Insights de Coaching
          </h4>
          <div className="space-y-2">
            {briefing.coaching_insights.slice(0, 3).map((insight, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-sm font-medium">{insight.seller}</p>
                <p className="text-xs text-muted-foreground">{insight.insight}</p>
                <p className="text-xs text-purple-600 mt-1">→ {insight.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'sales' && briefing.at_risk_deals && briefing.at_risk_deals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Deals em Risco
          </h4>
          <div className="space-y-2">
            {briefing.at_risk_deals.slice(0, 3).map((deal, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{deal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {deal.days_since_contact && `Sem contato há ${deal.days_since_contact} dias`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-amber-600 shrink-0">
                  {formatCurrency(deal.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AIBriefingCard({ briefingType, className }: AIBriefingCardProps) {
  const { briefing, isLoading, refetch } = useDailyBriefing(briefingType);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const titleMap = {
    owner: 'Briefing Estratégico',
    manager: 'Briefing de Coaching',
    sales: 'Briefing do Dia'
  };

  const subtitleMap = {
    owner: 'Visão executiva da sua operação',
    manager: 'Recomendações para seu time',
    sales: 'Suas prioridades de hoje'
  };

  return (
    <Card className={cn('border-primary/20 bg-gradient-to-br from-primary/5 to-transparent', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/20">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                AI {titleMap[briefingType]}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{subtitleMap[briefingType]}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', (isLoading || isRefreshing) && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : briefing ? (
          <BriefingContent briefing={briefing} type={briefingType} />
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Não foi possível gerar o briefing.</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
