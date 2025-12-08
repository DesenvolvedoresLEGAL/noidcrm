import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Sparkles,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WinLossHub() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [aiInsights, setAiInsights] = useState<any>(null);

  // Dados de Win/Loss
  const { data: winLossData, isLoading } = useQuery({
    queryKey: ['winloss-data', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      
      // Buscar registros de win/loss
      const { data: records, error } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            valor_previsto,
            account:accounts(segmento, porte)
          ),
          reason:loss_reasons(name)
        `)
        .eq('organization_id', organization.id)
        .gte('created_at', startOfYear)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Processar dados
      const wins = records?.filter(r => r.outcome === 'won') || [];
      const losses = records?.filter(r => r.outcome === 'lost') || [];
      
      // Agrupar motivos de perda
      const lossReasonCounts: Record<string, number> = {};
      losses.forEach(l => {
        const reason = l.reason_seller || (l.reason as any)?.name || 'Não informado';
        lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
      });
      
      // Agrupar concorrentes
      const competitorCounts: Record<string, number> = {};
      losses.filter(l => l.competitor).forEach(l => {
        competitorCounts[l.competitor!] = (competitorCounts[l.competitor!] || 0) + 1;
      });
      
      // Fatores de decisão
      const factors = {
        price: losses.filter(l => l.price_factor).length,
        timing: losses.filter(l => l.timing_factor).length,
        feature: losses.filter(l => l.feature_factor).length,
        relationship: losses.filter(l => l.relationship_factor).length
      };
      
      // Valores
      const wonValue = wins.reduce((sum, w) => sum + (w.final_value || (w.opportunity as any)?.valor_previsto || 0), 0);
      const lostValue = losses.reduce((sum, l) => sum + (l.final_value || (l.opportunity as any)?.valor_previsto || 0), 0);
      
      // Ciclo de venda médio
      const avgCycleWon = wins.length > 0
        ? Math.round(wins.reduce((sum, w) => sum + (w.sales_cycle_days || 0), 0) / wins.length)
        : 0;
      const avgCycleLost = losses.length > 0
        ? Math.round(losses.reduce((sum, l) => sum + (l.sales_cycle_days || 0), 0) / losses.length)
        : 0;
      
      return {
        wins,
        losses,
        wonCount: wins.length,
        lostCount: losses.length,
        winRate: wins.length + losses.length > 0 
          ? Math.round(wins.length / (wins.length + losses.length) * 100)
          : 0,
        wonValue,
        lostValue,
        lossReasons: Object.entries(lossReasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        competitors: Object.entries(competitorCounts)
          .map(([competitor, count]) => ({ competitor, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        factors,
        avgCycleWon,
        avgCycleLost
      };
    },
    enabled: !!organization?.id
  });

  // Mutation para análise AI
  const analyzeWinLossMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('analyze-winloss-batch', {
        body: { organizationId: organization.id, dateRange: 'year' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAiInsights(data);
      toast({
        title: 'Análise concluída',
        description: `${data.insights?.length || 0} insights gerados`
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro na análise',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const totalFactors = winLossData 
    ? winLossData.factors.price + winLossData.factors.timing + winLossData.factors.feature + winLossData.factors.relationship
    : 0;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <BarChart3 className="h-4 w-4" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getInsightColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-500/30 bg-red-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Win/Loss Insight Hub</h1>
          <p className="text-muted-foreground">
            Análise de motivos de ganho e perda para otimização de vendas
          </p>
        </div>
        <Button
          onClick={() => analyzeWinLossMutation.mutate()}
          disabled={analyzeWinLossMutation.isPending}
        >
          {analyzeWinLossMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Analisar com IA
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals Ganhos</p>
                <p className="text-2xl font-bold text-emerald-500">{winLossData?.wonCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals Perdidos</p>
                <p className="text-2xl font-bold text-red-500">{winLossData?.lostCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{winLossData?.winRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Perdido</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(winLossData?.lostValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Motivos de Perda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-500" />
              Top Motivos de Perda
            </CardTitle>
            <CardDescription>Principais razões mencionadas pelos vendedores</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : winLossData?.lossReasons && winLossData.lossReasons.length > 0 ? (
              <div className="space-y-4">
                {winLossData.lossReasons.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.reason}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                    <Progress 
                      value={(item.count / (winLossData.lossReasons[0]?.count || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum dado de perda registrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concorrentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Perdas por Concorrente
            </CardTitle>
            <CardDescription>Concorrentes mais frequentes em perdas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : winLossData?.competitors && winLossData.competitors.length > 0 ? (
              <div className="space-y-4">
                {winLossData.competitors.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.competitor}</span>
                      <Badge variant="secondary">{item.count} perdas</Badge>
                    </div>
                    <Progress 
                      value={(item.count / (winLossData.competitors[0]?.count || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum concorrente registrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fatores de Decisão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-500" />
              Fatores de Decisão (Perdas)
            </CardTitle>
            <CardDescription>O que influenciou as perdas</CardDescription>
          </CardHeader>
          <CardContent>
            {winLossData?.factors && totalFactors > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-red-500 mb-2" />
                  <p className="text-2xl font-bold">{winLossData.factors.price}</p>
                  <p className="text-sm text-muted-foreground">Preço</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <Target className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold">{winLossData.factors.timing}</p>
                  <p className="text-sm text-muted-foreground">Timing</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <BarChart3 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{winLossData.factors.feature}</p>
                  <p className="text-sm text-muted-foreground">Features</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <Users className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{winLossData.factors.relationship}</p>
                  <p className="text-sm text-muted-foreground">Relacionamento</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum fator de decisão registrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ciclo de Venda */}
        <Card>
          <CardHeader>
            <CardTitle>Ciclo de Venda Médio</CardTitle>
            <CardDescription>Comparação entre ganhos e perdas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <TrendingUp className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                <p className="text-3xl font-bold text-emerald-500">{winLossData?.avgCycleWon || 0}</p>
                <p className="text-sm text-muted-foreground">dias (ganhos)</p>
              </div>
              <div className="text-center p-6 rounded-lg bg-red-500/5 border border-red-500/20">
                <TrendingDown className="h-10 w-10 mx-auto text-red-500 mb-3" />
                <p className="text-3xl font-bold text-red-500">{winLossData?.avgCycleLost || 0}</p>
                <p className="text-sm text-muted-foreground">dias (perdas)</p>
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-center">
                {winLossData && winLossData.avgCycleWon < winLossData.avgCycleLost ? (
                  <span className="text-emerald-500">
                    ✓ Deals ganhos fecham {winLossData.avgCycleLost - winLossData.avgCycleWon} dias mais rápido
                  </span>
                ) : winLossData && winLossData.avgCycleWon > winLossData.avgCycleLost ? (
                  <span className="text-yellow-500">
                    ⚠ Deals perdidos estão sendo descartados mais rapidamente
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Ciclos similares entre ganhos e perdas
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Section */}
      {aiInsights && aiInsights.insights && aiInsights.insights.length > 0 && (
        <Card className="border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-500">
              <Sparkles className="h-5 w-5" />
              Insights da IA
            </CardTitle>
            {aiInsights.summary && (
              <CardDescription>{aiInsights.summary}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {aiInsights.insights.map((insight: any, index: number) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${getInsightColor(insight.impact)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      {insight.metric && (
                        <Badge variant="secondary" className="mt-2">{insight.metric}</Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        insight.impact === 'high' ? 'border-red-500 text-red-500' :
                        insight.impact === 'medium' ? 'border-yellow-500 text-yellow-500' :
                        'border-blue-500 text-blue-500'
                      }
                    >
                      {insight.impact === 'high' ? 'Alto' : insight.impact === 'medium' ? 'Médio' : 'Baixo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {aiInsights.actionItems && aiInsights.actionItems.length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Ações Recomendadas
                </h4>
                <ul className="space-y-2">
                  {aiInsights.actionItems.map((action: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
