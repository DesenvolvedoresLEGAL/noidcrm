import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Trophy, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityWithScore } from '@/hooks/useOpportunityScoreAnalytics';

interface OpportunityWinPredictionsProps {
  topOpportunities: OpportunityWithScore[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function OpportunityWinPredictions({ topOpportunities, isLoading }: OpportunityWinPredictionsProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  if (topOpportunities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Oportunidades por AI Win Probability
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
            <Brain className="h-3 w-3 mr-1" />
            Machine Learning
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topOpportunities.map((opp, index) => (
            <div 
              key={opp.id}
              className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md group"
              onClick={() => navigate(`/app/opportunities/${opp.id}`)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center",
                  index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                  index === 1 ? "bg-gray-300/30 text-gray-600" :
                  index === 2 ? "bg-orange-500/20 text-orange-600" :
                  "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {opp.title}
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground truncate mb-2">
                {opp.account?.nome_fantasia || opp.account?.razao_social}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-lg font-bold text-purple-600">{opp.win_probability_ai}%</span>
                </div>
                <TrendingUp className={cn(
                  "h-4 w-4",
                  (opp.win_probability_ai || 0) >= 70 ? "text-green-500" :
                  (opp.win_probability_ai || 0) >= 50 ? "text-yellow-500" : "text-red-500"
                )} />
              </div>
              
              <div className="mt-2 text-sm font-medium">
                {formatCurrency(opp.valor_previsto || 0)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
