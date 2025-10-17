import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, DollarSign, Calendar } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRiskOpportunities, RiskOpportunity } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

export function RiskOpportunities() {
  const [opportunities, setOpportunities] = useState<RiskOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRiskOpportunities().then(result => {
      setOpportunities(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Alto Risco';
      case 'medium': return 'Atenção';
      case 'low': return 'Normal';
      default: return level;
    }
  };

  return (
    <InsightCard
      title="Oportunidades que Precisam de Atenção"
      description="Priorize contatos com estas oportunidades"
      icon={AlertTriangle}
      iconColor="text-orange-500"
    >
      <div className="space-y-3">
        {opportunities.map((opp, idx) => (
          <div
            key={opp.id}
            className="p-4 rounded-lg border bg-card hover:shadow-md transition-all animate-fade-in"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">{opp.name}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {opp.stage}
                  </Badge>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    R$ {(opp.value / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
              <Badge className={cn('text-xs font-medium', getRiskColor(opp.riskLevel))}>
                {getRiskLabel(opp.riskLevel)}
              </Badge>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {opp.daysInStage} dias no estágio
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Há {opp.lastContactDays} dias sem contato
                </span>
              </div>
            </div>

            {/* Suggested Action */}
            <div className="p-3 rounded-lg bg-muted/50 mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Ação sugerida:
              </div>
              <div className="text-sm">{opp.suggestedAction}</div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="default" className="flex-1">
                Agendar Follow-up
              </Button>
              <Button size="sm" variant="outline">
                Ver Detalhes
              </Button>
            </div>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}
