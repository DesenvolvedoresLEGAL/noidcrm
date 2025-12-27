// NRHS Correlations - Blocos analíticos de correlações

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Target, Clock } from 'lucide-react';
import { NRHSCorrelation } from '@/services/crm/nrhs-analytics';

interface NRHSCorrelationsProps {
  correlations: NRHSCorrelation[];
  isLoading: boolean;
}

const CORRELATION_ICONS = {
  winrate: TrendingUp,
  forecast: Target,
  cycle: Clock,
};

const CORRELATION_COLORS = {
  winrate: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
  forecast: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
  cycle: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
};

const ICON_COLORS = {
  winrate: 'text-emerald-500',
  forecast: 'text-blue-500',
  cycle: 'text-purple-500',
};

export function NRHSCorrelations({ correlations, isLoading }: NRHSCorrelationsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-5 w-32 mb-3" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {correlations.map((correlation) => {
        const Icon = CORRELATION_ICONS[correlation.type];
        const colorClass = CORRELATION_COLORS[correlation.type];
        const iconColorClass = ICON_COLORS[correlation.type];

        return (
          <Card 
            key={correlation.type} 
            className={`border bg-gradient-to-br ${colorClass}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-5 w-5 ${iconColorClass}`} />
                <h3 className="font-medium text-foreground">{correlation.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {correlation.insight}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
