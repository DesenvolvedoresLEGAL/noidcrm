import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Building2, DollarSign } from 'lucide-react';

interface TopOpportunitiesProps {
  opportunities: any[];
  onOpportunityClick: (id: string) => void;
}

export function TopOpportunities({ opportunities, onOpportunityClick }: TopOpportunitiesProps) {
  const topOpps = opportunities
    .map((opp) => ({
      ...opp,
      score: (opp.valor_previsto || 0) * (opp.prob || 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Top 5 Oportunidades Quentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topOpps.map((opp, index) => (
            <div
              key={opp.id}
              onClick={() => onOpportunityClick(opp.id)}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{opp.account_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {opp.produto}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(opp.prob * 100).toFixed(0)}% probabilidade
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-primary font-semibold">
                  <DollarSign className="h-4 w-4" />
                  <span>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                    }).format(opp.valor_previsto || 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Score: {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                  }).format(opp.score)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
