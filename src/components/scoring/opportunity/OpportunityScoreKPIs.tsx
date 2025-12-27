import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Zap, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpportunityScoreKPIsProps {
  kpis: {
    totalOpportunities: number;
    averageScore: number;
    highScore: number;
    mediumScore: number;
    lowScore: number;
    highRisk: number;
    totalValue: number;
    valueAtRisk: number;
  };
  onFilterScore: (range: 'high' | 'medium' | 'low' | null) => void;
  activeRange?: 'high' | 'medium' | 'low' | null;
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

export function OpportunityScoreKPIs({ kpis, onFilterScore, activeRange, isLoading }: OpportunityScoreKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-8 w-12" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Total */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Total</span>
              </div>
              <div className="text-2xl font-bold">{kpis.totalOpportunities}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Total de oportunidades abertas</p></TooltipContent>
      </Tooltip>

      {/* High Score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={cn("border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent cursor-pointer hover:shadow-md transition-all", activeRange === 'high' && "ring-2 ring-primary")}
            onClick={() => onFilterScore(activeRange === 'high' ? null : 'high')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Score Alto</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600">{kpis.highScore}</div>
                <Badge variant="outline" className="text-xs text-green-600">≥70</Badge>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Oportunidades com alta probabilidade de fechamento</p></TooltipContent>
      </Tooltip>

      {/* Medium Score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={cn("border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent cursor-pointer hover:shadow-md transition-all", activeRange === 'medium' && "ring-2 ring-primary")}
            onClick={() => onFilterScore(activeRange === 'medium' ? null : 'medium')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-xs font-medium text-muted-foreground">Score Médio</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-yellow-600">{kpis.mediumScore}</div>
                <Badge variant="outline" className="text-xs text-yellow-600">40-69</Badge>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Oportunidades com chance moderada. Precisam de atenção.</p></TooltipContent>
      </Tooltip>

      {/* Low Score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={cn("border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent cursor-pointer hover:shadow-md transition-all", activeRange === 'low' && "ring-2 ring-primary")}
            onClick={() => onFilterScore(activeRange === 'low' ? null : 'low')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">Score Baixo</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-orange-600">{kpis.lowScore}</div>
                <Badge variant="outline" className="text-xs text-orange-600">&lt;40</Badge>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Oportunidades com baixa probabilidade. Avalie se vale investir esforço.</p></TooltipContent>
      </Tooltip>

      {/* High Risk */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Alto Risco</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-red-600">{kpis.highRisk}</div>
                <Badge variant="outline" className="text-xs text-red-600">Risk≥60</Badge>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Oportunidades com indicadores de risco elevados</p></TooltipContent>
      </Tooltip>

      {/* Value at Risk */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Valor em Risco</span>
              </div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(kpis.valueAtRisk)}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p>Valor total das oportunidades com alto risco (Risk Score ≥ 60)</p></TooltipContent>
      </Tooltip>
    </div>
  );
}
