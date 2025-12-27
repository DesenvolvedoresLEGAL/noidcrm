// NRHS Insights Panel - Insights automáticos de higiene

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, ArrowRight, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { NRHSInsight } from '@/services/crm/nrhs-analytics';

interface NRHSInsightsPanelProps {
  insights: NRHSInsight[];
  isLoading: boolean;
  onViewDeals: (insightId: string, pillar: string) => void;
}

const SEVERITY_STYLES = {
  high: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    iconColor: 'text-red-500',
  },
  medium: {
    icon: AlertTriangle,
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    iconColor: 'text-yellow-500',
  },
  low: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-500',
  },
};

export function NRHSInsightsPanel({ insights, isLoading, onViewDeals }: NRHSInsightsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Insights de Higiene
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum insight relevante no momento</p>
            <p className="text-sm mt-1">Continue mantendo a higiene do pipeline!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Insights de Higiene
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight) => {
            const styles = SEVERITY_STYLES[insight.severity];
            const Icon = styles.icon;

            return (
              <div 
                key={insight.id}
                className={`p-4 rounded-lg border ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 ${styles.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {insight.text}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {insight.pillar}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {insight.dealCount} {insight.dealCount === 1 ? 'deal' : 'deals'} afetados
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onViewDeals(insight.id, insight.pillar)}
                  >
                    <span className="hidden sm:inline mr-1">Ver deals</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
