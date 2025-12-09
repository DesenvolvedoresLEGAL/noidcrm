import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Target, Users, TrendingUp, AlertTriangle, RefreshCw, 
  Flame, Snowflake, ThermometerSun, Brain, BarChart3,
  Zap, Shield, TrendingDown, Info, Sparkles, Activity
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
  const [activeTab, setActiveTab] = useState('opportunities');

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
      toast.success(`Scores de ${type === 'account' ? 'leads (contas)' : 'oportunidades'} recalculados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['scoring-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-opportunities-by-score'] });
      queryClient.invalidateQueries({ queryKey: ['leads-by-grade'] });
    },
    onError: () => {
      toast.error('Erro ao recalcular scores');
    }
  });

  const gradeCards = [
    { 
      grade: 'A', 
      label: 'Quentes', 
      icon: Flame, 
      color: 'text-green-500', 
      bgColor: 'bg-gradient-to-br from-green-500/20 to-green-600/10',
      borderColor: 'border-green-500/30',
      tooltip: 'Lead Score ≥ 80 pontos. Leads com alto FIT e INTENT - prioridade máxima de contato!'
    },
    { 
      grade: 'B', 
      label: 'Ativos', 
      icon: TrendingUp, 
      color: 'text-blue-500', 
      bgColor: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      tooltip: 'Lead Score 60-79 pontos. Leads engajados que demonstram interesse ativo.'
    },
    { 
      grade: 'C', 
      label: 'Mornos', 
      icon: ThermometerSun, 
      color: 'text-yellow-500', 
      bgColor: 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10',
      borderColor: 'border-yellow-500/30',
      tooltip: 'Lead Score 40-59 pontos. Leads com potencial mas precisam de nutrição.'
    },
    { 
      grade: 'D', 
      label: 'Frios', 
      icon: Snowflake, 
      color: 'text-orange-500', 
      bgColor: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10',
      borderColor: 'border-orange-500/30',
      tooltip: 'Lead Score 20-39 pontos. Leads com baixo engajamento - requerem reativação.'
    },
    { 
      grade: 'F', 
      label: 'Gelados', 
      icon: Snowflake, 
      color: 'text-red-500', 
      bgColor: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
      borderColor: 'border-red-500/30',
      tooltip: 'Lead Score < 20 pontos. Leads sem engajamento - considere reciclar ou desqualificar.'
    },
  ];

  const handleViewLeads = (grade: string) => {
    setSelectedGrade(grade);
    setActiveTab('leads');
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Lead & Opportunity Scoring
                  <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Preditiva
                  </Badge>
                </h2>
                <p className="text-muted-foreground">
                  Scoring inteligente com machine learning para priorização de leads e oportunidades
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={() => recalculateMutation.mutate('account')}
                    disabled={recalculateMutation.isPending}
                    className="bg-background/50 backdrop-blur-sm"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
                    Recalcular Leads
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recalcula FIT, INTENT e Lead Score de todas as contas</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    onClick={() => recalculateMutation.mutate('opportunity')}
                    disabled={recalculateMutation.isPending}
                    className="bg-background/50 backdrop-blur-sm"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
                    Recalcular Opps
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recalcula scores e AI Win Probability de oportunidades abertas</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Section: Lead Grades */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Leads por Grade</h3>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Como funciona o Lead Score?</p>
                <p className="text-xs">Lead Score = (FIT × 40%) + (INTENT × 60%)</p>
                <p className="text-xs mt-1">FIT avalia o perfil da empresa. INTENT avalia o comportamento e engajamento.</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-sm text-muted-foreground ml-2">
              (distribuição de {summary?.totalLeads || 0} contas por score)
            </span>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            {gradeCards.map(({ grade, label, icon: Icon, color, bgColor, borderColor, tooltip }) => (
              <Tooltip key={grade}>
                <TooltipTrigger asChild>
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2",
                      selectedGrade === grade ? "ring-2 ring-primary shadow-lg" : borderColor
                    )}
                    onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                  >
                    <CardContent className="p-4">
                      <div className={cn("flex items-center justify-between rounded-xl p-3 mb-3", bgColor)}>
                        <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg", getGradeColor(grade))}>
                          {grade}
                        </div>
                        <Icon className={cn("h-7 w-7", color)} />
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {summary?.leadGrades[grade as keyof typeof summary.leadGrades] || 0}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">{label}</div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Section: Opportunity Health KPIs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Saúde das Oportunidades</h3>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Como funciona o Opportunity Score?</p>
                <p className="text-xs">Combina Engagement (atividades), Velocity (velocidade no funil) e Risk (fatores de risco).</p>
                <p className="text-xs mt-1">A AI Win Probability usa machine learning para prever chance de fechamento.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Score ≥ 70</Badge>
                </div>
                <div className="text-3xl font-bold text-green-600">{summary?.opportunityScores?.high || 0}</div>
                <div className="text-sm text-muted-foreground">Score Alto</div>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 text-yellow-500" />
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Score 40-69</Badge>
                </div>
                <div className="text-3xl font-bold text-yellow-600">{summary?.opportunityScores?.medium || 0}</div>
                <div className="text-sm text-muted-foreground">Score Médio</div>
              </CardContent>
            </Card>
            
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Score &lt; 40</Badge>
                </div>
                <div className="text-3xl font-bold text-orange-600">{summary?.opportunityScores?.low || 0}</div>
                <div className="text-sm text-muted-foreground">Score Baixo</div>
              </CardContent>
            </Card>
            
            <Card className="border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  <Badge variant="outline" className="text-red-600 border-red-300 text-xs">Risk ≥ 60</Badge>
                </div>
                <div className="text-3xl font-bold text-red-600">{summary?.highRiskCount || 0}</div>
                <div className="text-sm text-muted-foreground">Alto Risco</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs - Controlled */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="opportunities" className="flex items-center gap-2 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4" />
              Top Oportunidades
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              Leads por Score
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2 data-[state=active]:bg-background">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Top 10 Oportunidades por Score
                  </CardTitle>
                  <Badge variant="secondary" className="bg-primary/10">
                    <Brain className="h-3 w-3 mr-1" />
                    AI Win Probability
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingOpportunities ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="space-y-2">
                    {topOpportunities?.map((opp: any, index: number) => (
                      <div 
                        key={opp.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm group"
                        onClick={() => navigate(`/app/opportunities/${opp.id}`)}
                      >
                        <div className={cn(
                          "text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center",
                          index < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate group-hover:text-primary transition-colors">{opp.title}</div>
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
                          <div className="text-right min-w-[120px]">
                            <div className="font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_previsto || 0)}
                            </div>
                            {opp.win_probability_ai && (
                              <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Brain className="h-3 w-3 text-primary" />
                                <span className="font-medium text-primary">{opp.win_probability_ai}%</span> AI
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
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
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
                  <div className="space-y-2">
                    {leadsByGrade?.slice(0, 20).map((lead: any) => (
                      <div 
                        key={lead.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm group"
                        onClick={() => navigate(`/app/accounts/${lead.id}`)}
                      >
                        <LeadGradeBadge grade={lead.lead_grade || 'D'} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate group-hover:text-primary transition-colors">
                            {lead.nome_fantasia || lead.razao_social}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {lead.segmento} • {lead.tamanho}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">FIT</div>
                                <div className="font-medium">{lead.fit_score || 0}</div>
                                <Progress value={lead.fit_score || 0} className="h-1 w-12 mt-1" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>FIT Score: Avalia o perfil da empresa (segmento, tamanho, capital, localização)</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">INTENT</div>
                                <div className="font-medium">{lead.intent_score || 0}</div>
                                <Progress value={lead.intent_score || 0} className="h-1 w-12 mt-1" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>INTENT Score: Avalia o comportamento (atividades, visualizações, engajamento)</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">LEAD</div>
                                <div className="font-bold text-primary text-lg">{lead.lead_score || 0}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Lead Score = (FIT × 40%) + (INTENT × 60%)</p>
                            </TooltipContent>
                          </Tooltip>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Alertas de Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.highRiskCount && summary.highRiskCount > 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/20">
                      <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-red-700 dark:text-red-400">
                          {summary.highRiskCount} oportunidades em alto risco
                        </div>
                        <div className="text-sm text-red-600/80 dark:text-red-400/80">
                          Risk Score ≥ 60 - Necessitam atenção imediata
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 border-red-300 hover:bg-red-500/10"
                        onClick={() => setActiveTab('opportunities')}
                      >
                        Ver oportunidades
                      </Button>
                    </div>
                  )}
                  
                  {summary?.leadGrades?.F && summary.leadGrades.F > 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20">
                      <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Snowflake className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-orange-700 dark:text-orange-400">
                          {summary.leadGrades.F} leads Grade F (Gelados)
                        </div>
                        <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
                          Considere reciclar ou desqualificar estes leads
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-orange-600 border-orange-300 hover:bg-orange-500/10"
                        onClick={() => handleViewLeads('F')}
                      >
                        Ver leads
                      </Button>
                    </div>
                  )}

                  {summary?.leadGrades?.A && summary.leadGrades.A > 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
                      <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Flame className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-green-700 dark:text-green-400">
                          {summary.leadGrades.A} leads Grade A 🔥 (Quentes)
                        </div>
                        <div className="text-sm text-green-600/80 dark:text-green-400/80">
                          Leads quentes - Prioridade máxima de contato!
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-green-600 border-green-300 hover:bg-green-500/10"
                        onClick={() => handleViewLeads('A')}
                      >
                        Ver leads
                      </Button>
                    </div>
                  )}

                  {!summary?.highRiskCount && !summary?.leadGrades?.F && !summary?.leadGrades?.A && (
                    <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <p>Nenhum alerta no momento</p>
                      <p className="text-sm">Todos os scores estão em níveis saudáveis</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{summary?.totalLeads || 0}</div>
                <div className="text-sm text-muted-foreground">Total de Leads</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{summary?.opportunityScores?.high || 0}</div>
                <div className="text-sm text-muted-foreground">Opps Score Alto</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{summary?.opportunityScores?.medium || 0}</div>
                <div className="text-sm text-muted-foreground">Opps Score Médio</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{summary?.highRiskCount || 0}</div>
                <div className="text-sm text-muted-foreground">Alto Risco</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
