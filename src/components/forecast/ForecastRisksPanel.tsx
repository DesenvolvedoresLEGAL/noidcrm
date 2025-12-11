import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForecastOpportunity } from '@/hooks/useForecastData';
import { AlertTriangle, Clock, CalendarX, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDateOnly, formatDateShortBR } from '@/lib/dateUtils';

interface ForecastRisksPanelProps {
  opportunities: ForecastOpportunity[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ForecastRisksPanel({ opportunities }: ForecastRisksPanelProps) {
  const now = new Date();

  // Critical: 14+ days without activity
  const critical = opportunities.filter(o => o.days_since_activity >= 14);
  
  // High: 7-13 days without activity
  const attention = opportunities.filter(o => o.days_since_activity >= 7 && o.days_since_activity < 14);
  
  // Slipping: close date has passed
  const slipping = opportunities.filter(o => {
    if (!o.close_date_prevista) return false;
    return parseDateOnly(o.close_date_prevista) < now;
  });

  const criticalValue = critical.reduce((sum, o) => sum + o.valor_previsto, 0);
  const attentionValue = attention.reduce((sum, o) => sum + o.valor_previsto, 0);
  const slippingValue = slipping.reduce((sum, o) => sum + o.valor_previsto, 0);

  const sections = [
    {
      title: 'Crítico',
      subtitle: '14+ dias sem atividade',
      icon: AlertTriangle,
      items: critical,
      value: criticalValue,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    {
      title: 'Atenção',
      subtitle: '7-13 dias sem atividade',
      icon: Clock,
      items: attention,
      value: attentionValue,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
    },
    {
      title: 'Slipping',
      subtitle: 'Close date passou',
      icon: CalendarX,
      items: slipping,
      value: slippingValue,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
    },
  ];

  const totalAtRisk = criticalValue + attentionValue + slippingValue;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Deals em Risco
          </CardTitle>
          {totalAtRisk > 0 && (
            <Badge variant="destructive" className="text-xs">
              {formatCurrency(totalAtRisk)} em risco
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className={cn('rounded-lg border p-3', section.borderColor, section.bgColor)}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <section.icon className={cn('h-4 w-4', section.color)} />
                <div>
                  <span className={cn('text-sm font-semibold', section.color)}>
                    {section.title}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({section.subtitle})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className={cn('text-sm font-bold', section.color)}>
                  {section.items.length}
                </span>
                <span className="text-xs text-muted-foreground ml-1">deals</span>
                <span className="text-xs text-muted-foreground mx-1">•</span>
                <span className="text-xs font-medium">{formatCurrency(section.value)}</span>
              </div>
            </div>

            {section.items.length > 0 && (
              <div className="space-y-1 mt-3">
                {section.items.slice(0, 5).map((opp) => (
                  <div
                    key={opp.id}
                    className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{opp.title}</span>
                      <span className="text-muted-foreground">{opp.owner_name}</span>
                    </div>
                    <div className="text-right ml-2">
                      <span className="font-semibold">{formatCurrency(opp.valor_previsto)}</span>
                      {opp.close_date_prevista && (
                        <span className="text-muted-foreground ml-2">
                          {formatDateShortBR(opp.close_date_prevista)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {section.items.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{section.items.length - 5} mais...
                  </p>
                )}
              </div>
            )}

            {section.items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum deal nesta categoria
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
