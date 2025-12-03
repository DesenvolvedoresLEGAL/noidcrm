import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, Users, TrendingUp, AlertTriangle, RefreshCw, 
  Flame, Snowflake, ThermometerSun, Brain, BarChart3 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  getScoringSummary, 
  getLeadsByGrade, 
  getTopOpportunitiesByScore,
  recalculateAllScores,
  getGradeColor
} from '@/services/crm/scoring';
import { LeadGradeBadge } from './LeadGradeBadge';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { useNavigate } from 'react-router-dom';

export function ScoringDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['scoring-summary'],
    queryFn: getScoringSummary
  });

  const { data: topOpportunities, isLoading: loadingOpportunities } = useQuery({
    queryKey: ['top-opportunities-by-score'],
    queryFn: () => getTopOpportunitiesByScore(10)
  });

  const { data: leadsByGrade, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads-by-grade', selectedGrade],
    queryFn: () => getLeadsByGrade(selectedGrade || undefined)
  });

  const recalculateMutation = useMutation({
    mutationFn: async (type: 'account' | 'opportunity') => {
      return recalculateAllScores(type);
    },
    onSuccess: (_, type) => {
      toast.success(`Scores de ${type === 'account' ? 'contas' : 'oportunidades'} recalculados!`);
      queryClient.invalidateQueries({ queryKey: ['scoring-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-opportunities-by-score'] });
      queryClient.invalidateQueries({ queryKey: ['leads-by-grade'] });
    },
    onError: () => {
      toast.error('Erro ao recalcular scores');
    }
  });

  const gradeCards = [
    { grade: 'A', label: 'Quentes', icon: Flame, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { grade: 'B', label: 'Ativos', icon: TrendingUp, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { grade: 'C', label: 'Mornos', icon: ThermometerSun, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    { grade: 'D', label: 'Frios', icon: Snowflake, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { grade: 'F', label: 'Gelados', icon: Snowflake, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Lead & Opportunity Scoring
          </h2>
          <p className="text-muted-foreground">
            Inteligência de scoring com AI preditiva
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => recalculateMutation.mutate('account')}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
            Recalcular Leads
          </Button>
          <Button 
            variant="outline"
            onClick={() => recalculateMutation.mutate('opportunity')}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
            Recalcular Opps
          </Button>
        </div>
      </div>

      {/* Lead Grade Cards */}
      <div className="grid grid-cols-5 gap-4">
        {gradeCards.map(({ grade, label, icon: Icon, color, bgColor }) => (
          <Card 
            key={grade}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedGrade === grade && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
          >
            <CardContent className="p-4">
              <div className={cn("flex items-center justify-between", bgColor, "rounded-lg p-3 mb-2")}>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-bold", getGradeColor(grade))}>
                  {grade}
                </div>
                <Icon className={cn("h-6 w-6", color)} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {summary?.leadGrades[grade as keyof typeof summary.leadGrades] || 0}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Top Oportunidades
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Leads por Score
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Oportunidades por Score</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOpportunities ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="space-y-3">
                  {topOpportunities?.map((opp: any, index: number) => (
                    <div 
                      key={opp.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/opportunities/${opp.id}`)}
                    >
                      <div className="text-lg font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{opp.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {opp.account?.nome_fantasia || opp.account?.razao_social}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <OpportunityScoreBadge 
                          score={opp.opportunity_score || 0}
                          riskScore={opp.risk_score}
                          winProbability={opp.win_probability_ai}
                        />
                        <div className="text-right">
                          <div className="font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_previsto || 0)}
                          </div>
                          {opp.win_probability_ai && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Brain className="h-3 w-3" />
                              {opp.win_probability_ai}% AI
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!topOpportunities || topOpportunities.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma oportunidade encontrada
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedGrade ? `Leads Grade ${selectedGrade}` : 'Todos os Leads'}
                </CardTitle>
                {selectedGrade && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGrade(null)}>
                    Limpar filtro
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingLeads ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="space-y-3">
                  {leadsByGrade?.slice(0, 20).map((lead: any) => (
                    <div 
                      key={lead.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/accounts/${lead.id}`)}
                    >
                      <LeadGradeBadge grade={lead.lead_grade || 'D'} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {lead.nome_fantasia || lead.razao_social}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {lead.segmento} • {lead.tamanho}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">FIT</div>
                          <div className="font-medium">{lead.fit_score || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">INTENT</div>
                          <div className="font-medium">{lead.intent_score || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">LEAD</div>
                          <div className="font-bold text-primary">{lead.lead_score || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!leadsByGrade || leadsByGrade.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas de Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary?.highRiskCount && summary.highRiskCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div className="flex-1">
                      <div className="font-medium text-red-700">
                        {summary.highRiskCount} oportunidades em alto risco
                      </div>
                      <div className="text-sm text-red-600/80">
                        Risk Score ≥ 60 - Necessitam atenção imediata
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300">
                      Ver todas
                    </Button>
                  </div>
                )}
                
                {summary?.leadGrades?.F && summary.leadGrades.F > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <Snowflake className="h-5 w-5 text-orange-500" />
                    <div className="flex-1">
                      <div className="font-medium text-orange-700">
                        {summary.leadGrades.F} leads Grade F
                      </div>
                      <div className="text-sm text-orange-600/80">
                        Considere reciclar ou desqualificar
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-orange-600 border-orange-300"
                      onClick={() => setSelectedGrade('F')}
                    >
                      Ver leads
                    </Button>
                  </div>
                )}

                {summary?.leadGrades?.A && summary.leadGrades.A > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Flame className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <div className="font-medium text-green-700">
                        {summary.leadGrades.A} leads Grade A 🔥
                      </div>
                      <div className="text-sm text-green-600/80">
                        Leads quentes - Prioridade máxima de contato
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-green-600 border-green-300"
                      onClick={() => setSelectedGrade('A')}
                    >
                      Ver leads
                    </Button>
                  </div>
                )}

                {!summary?.highRiskCount && !summary?.leadGrades?.F && !summary?.leadGrades?.A && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum alerta no momento
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{summary?.totalLeads || 0}</div>
              <div className="text-sm text-muted-foreground">Total de Leads</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{summary?.opportunityScores?.high || 0}</div>
              <div className="text-sm text-muted-foreground">Opps Score Alto</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{summary?.opportunityScores?.medium || 0}</div>
              <div className="text-sm text-muted-foreground">Opps Score Médio</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{summary?.highRiskCount || 0}</div>
              <div className="text-sm text-muted-foreground">Alto Risco</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
