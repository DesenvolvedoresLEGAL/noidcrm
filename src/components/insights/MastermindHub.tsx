import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { 
  Brain,
  Zap,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Trophy,
  Flame,
  Sparkles,
  Activity,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  Award,
  Star,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RaioXData {
  pipeline: { total: number; weighted: number; deals: number };
  closedMonth: { value: number; count: number };
  lostMonth: { value: number; count: number };
  winRate: number;
  activitiesCompleted: number;
  activitiesPending: number;
  proposalsSent: number;
  proposalsViewed: number;
}

interface IndividualHighlight {
  userId: string;
  name: string;
  metric: string;
  value: string;
  type: 'positive' | 'warning' | 'neutral';
  icon: string;
}

interface TeamAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
}

interface RankingEntry {
  position: number;
  userId: string;
  name: string;
  wonValue: number;
  wonCount: number;
  activitiesCompleted: number;
}

interface MastermindData {
  raioX: RaioXData;
  highlights: IndividualHighlight[];
  alerts: TeamAlert[];
  directions: string[];
  provocacao: string;
  ranking: RankingEntry[];
  generatedAt: string;
}

export function MastermindHub() {
  const navigate = useNavigate();
  const { membership, profile, organization } = useCurrentUser();
  const [data, setData] = useState<MastermindData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const organizationId = organization?.id;
  const firstName = profile?.full_name?.split(' ')[0] || 'Líder';

  const handleAlertAction = (action: string) => {
    switch (action) {
      case 'Revisar deals urgentes':
        navigate('/app/pipeline?filter=at-risk');
        break;
      case 'Limpar pipeline':
        navigate('/app/pipeline?filter=stale');
        break;
      case 'Analisar propostas':
        navigate('/app/proposals');
        break;
      case 'Revisar qualificação':
        navigate('/app/pipeline');
        break;
      default:
        navigate('/app/pipeline');
    }
  };

  const fetchMastermindData = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch data sequentially to avoid type depth issues
      const oppsResult = await supabase
        .from('opportunities')
        .select('id, title, valor_previsto, prob, temperature, status, created_at, updated_at, close_date_prevista, owner_user_id, pipeline_id, stage_id')
        .eq('organization_id', organizationId);
        
      const activitiesResult = await supabase
        .from('activities')
        .select('id, type, status, owner_user_id, scheduled_date, completed_at, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', monthStart.toISOString());
        
      const proposalsResult = await supabase
        .from('proposals')
        .select('id, status, total_amount, created_at, sent_at, viewed_at, views_count, opportunity_id')
        .eq('organization_id', organizationId)
        .gte('created_at', monthStart.toISOString());
        
      const membersResult = await supabase
        .from('organization_members')
        .select('user_id, org_role, profiles(full_name)')
        .eq('organization_id', organizationId)
        .eq('status', 'active');
        
      const pipelinesResult = await supabase
        .from('pipelines')
        .select('id, name, pipeline_type')
        .eq('organization_id', organizationId);

      const opps: any[] = oppsResult.data || [];
      const activities: any[] = activitiesResult.data || [];
      const proposals: any[] = proposalsResult.data || [];
      const members: any[] = membersResult.data || [];
      const pipelines: any[] = pipelinesResult.data || [];

      const salesPipelineIds = pipelines.filter(p => p.pipeline_type === 'sales').map(p => p.id);
      const activeOpps = opps.filter(o => !['won', 'lost'].includes(o.status) && salesPipelineIds.includes(o.pipeline_id));
      // Use closed_at for accurate date tracking (immutable close date, fallback to updated_at)
      const wonThisMonth = opps.filter(o => {
        if (o.status !== 'won') return false;
        const closeDate = new Date(o.closed_at || o.updated_at);
        return closeDate >= monthStart;
      });
      const lostThisMonth = opps.filter(o => {
        if (o.status !== 'lost') return false;
        const closeDate = new Date(o.closed_at || o.updated_at);
        return closeDate >= monthStart;
      });

      // Raio-X do Dia
      const raioX: RaioXData = {
        pipeline: {
          total: activeOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          weighted: activeOpps.reduce((sum, o) => sum + ((o.valor_previsto || 0) * (o.prob || 0) / 100), 0),
          deals: activeOpps.length
        },
        closedMonth: {
          value: wonThisMonth.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          count: wonThisMonth.length
        },
        lostMonth: {
          value: lostThisMonth.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          count: lostThisMonth.length
        },
        winRate: (wonThisMonth.length + lostThisMonth.length) > 0
          ? (wonThisMonth.length / (wonThisMonth.length + lostThisMonth.length)) * 100
          : 0,
        activitiesCompleted: activities.filter(a => a.status === 'completed').length,
        activitiesPending: activities.filter(a => a.status === 'pending').length,
        proposalsSent: proposals.filter(p => p.status === 'sent' || p.viewed_at).length,
        proposalsViewed: proposals.filter(p => p.viewed_at && (p.views_count || 0) > 0).length
      };

      // Individual Highlights
      const highlights: IndividualHighlight[] = [];
      
      const salesMembers = members.filter(m => ['sales', 'manager'].includes(m.org_role));
      for (const member of salesMembers) {
        const memberWon = wonThisMonth.filter(o => o.owner_user_id === member.user_id);
        const memberLost = lostThisMonth.filter(o => o.owner_user_id === member.user_id);
        const memberActivities = activities.filter(a => a.owner_user_id === member.user_id && a.status === 'completed');
        const memberPending = activities.filter(a => a.owner_user_id === member.user_id && a.status === 'pending');
        const memberProposals = proposals.filter(p => {
          const opp = opps.find(o => o.id === p.opportunity_id);
          return opp && opp.owner_user_id === member.user_id;
        });

        const name = (member.profiles as any)?.full_name || 'Vendedor';
        
        // Best closer
        if (memberWon.length > 0) {
          const wonValue = memberWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
          if (wonValue > 0) {
            const formattedValue = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(wonValue);
            highlights.push({
              userId: member.user_id,
              name,
              metric: 'Fechou',
              value: `${formattedValue} em ${memberWon.length} deal${memberWon.length > 1 ? 's' : ''}`,
              type: 'positive',
              icon: 'trophy'
            });
          }
        }

        // Most active
        if (memberActivities.length >= 10) {
          highlights.push({
            userId: member.user_id,
            name,
            metric: 'Alta Atividade',
            value: `${memberActivities.length} atividades concluídas`,
            type: 'positive',
            icon: 'activity'
          });
        }

        // Risk: Many lost
        if (memberLost.length >= 2) {
          highlights.push({
            userId: member.user_id,
            name,
            metric: 'Atenção',
            value: `${memberLost.length} deals perdidos este mês`,
            type: 'warning',
            icon: 'alert'
          });
        }

        // Risk: Low activity
        if (memberActivities.length < 3 && memberPending.length > 5) {
          highlights.push({
            userId: member.user_id,
            name,
            metric: 'Baixa Execução',
            value: `${memberPending.length} atividades pendentes`,
            type: 'warning',
            icon: 'clock'
          });
        }
      }

      // Team Alerts
      const alerts: TeamAlert[] = [];

      // High-value at-risk deals
      const atRiskDeals = activeOpps.filter(o => {
        const closeDate = o.close_date_prevista ? new Date(o.close_date_prevista) : null;
        if (!closeDate) return false;
        const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return (o.valor_previsto || 0) > 10000 && daysUntilClose <= 7 && daysUntilClose > 0;
      });

      if (atRiskDeals.length > 0) {
        const totalAtRisk = atRiskDeals.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
        const formattedAtRisk = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(totalAtRisk);
        alerts.push({
          type: 'danger',
          title: `${atRiskDeals.length} deal${atRiskDeals.length > 1 ? 's' : ''} em risco iminente`,
          description: `${formattedAtRisk} pode ser perdido esta semana sem ação imediata`,
          action: 'Revisar deals urgentes'
        });
      }

      // Stale opportunities
      const staleOpps = activeOpps.filter(o => {
        const lastUpdate = new Date(o.updated_at);
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceUpdate > 14;
      });

      if (staleOpps.length > 3) {
        alerts.push({
          type: 'warning',
          title: `${staleOpps.length} oportunidades paradas`,
          description: 'Deals sem movimentação há mais de 14 dias. Avaliar se ainda são válidos.',
          action: 'Limpar pipeline'
        });
      }

      // Low proposal conversion
      const sentProposals = proposals.filter(p => p.sent_at);
      const acceptedProposals = proposals.filter(p => p.status === 'accepted');
      if (sentProposals.length > 5 && acceptedProposals.length === 0) {
        alerts.push({
          type: 'warning',
          title: 'Propostas sem conversão',
          description: `${sentProposals.length} propostas enviadas sem aceites. Revisar abordagem comercial.`,
          action: 'Analisar propostas'
        });
      }

      // Win rate alert
      if (raioX.winRate < 20 && (wonThisMonth.length + lostThisMonth.length) > 5) {
        alerts.push({
          type: 'danger',
          title: 'Win Rate crítico',
          description: `Taxa de conversão em ${raioX.winRate.toFixed(0)}%. Investigar qualidade dos leads.`,
          action: 'Revisar qualificação'
        });
      }

      // Directions for the team
      const directions: string[] = [];

      if (raioX.activitiesPending > raioX.activitiesCompleted) {
        directions.push('🎯 Foco em execução: mais atividades pendentes do que concluídas. Priorize fechamento das tarefas do dia.');
      }

      if (atRiskDeals.length > 0) {
        directions.push(`🔥 Ação imediata em ${atRiskDeals.length} deals quentes - são os mais próximos do close date.`);
      }

      if (raioX.proposalsViewed > 0 && raioX.proposalsViewed === raioX.proposalsSent) {
        directions.push('✨ Todas as propostas enviadas foram visualizadas. Momento de follow-up agressivo!');
      }

      if (wonThisMonth.length === 0 && activeOpps.length > 10) {
        directions.push('💡 Pipeline cheio mas sem fechamentos. Foco em mover deals para as etapas finais.');
      }

      if (staleOpps.length > 0) {
        directions.push(`🧹 Limpeza necessária: ${staleOpps.length} deals estagnados. Qualificar ou descartar.`);
      }

      if (directions.length === 0) {
        directions.push('✅ Operação saudável. Mantenha o ritmo e busque oportunidades de expansão.');
      }

      // Mini Ranking
      const ranking: RankingEntry[] = salesMembers
        .map(m => {
          const memberWon = wonThisMonth.filter(o => o.owner_user_id === m.user_id);
          const memberActivities = activities.filter(a => a.owner_user_id === m.user_id && a.status === 'completed');
          return {
            position: 0,
            userId: m.user_id,
            name: (m.profiles as any)?.full_name || 'Vendedor',
            wonValue: memberWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
            wonCount: memberWon.length,
            activitiesCompleted: memberActivities.length
          };
        })
        .sort((a, b) => b.wonValue - a.wonValue || b.activitiesCompleted - a.activitiesCompleted)
        .slice(0, 5)
        .map((entry, index) => ({ ...entry, position: index + 1 }));

      // Generate provocative message using AI
      let provocacao = generateProvocacao(raioX, highlights, alerts, ranking, firstName);

      setData({
        raioX,
        highlights: highlights.slice(0, 6),
        alerts: alerts.slice(0, 4),
        directions,
        provocacao,
        ranking,
        generatedAt: now.toISOString()
      });

    } catch (error) {
      console.error('Error fetching mastermind data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateProvocacao = (
    raioX: RaioXData,
    highlights: IndividualHighlight[],
    alerts: TeamAlert[],
    ranking: RankingEntry[],
    firstName: string
  ): string => {
    const provocacoes: string[] = [];

    // Based on win rate
    if (raioX.winRate >= 50) {
      provocacoes.push(`${firstName}, seu time está convertendo bem. A pergunta é: está mirando alto o suficiente? Com esse win rate, talvez seja hora de buscar deals maiores.`);
    } else if (raioX.winRate < 30 && raioX.winRate > 0) {
      provocacoes.push(`${firstName}, 7 de cada 10 oportunidades estão escapando. O problema é qualificação ou execução? Essa resposta vale milhares.`);
    }

    // Based on pipeline
    if (raioX.pipeline.total > 0 && raioX.closedMonth.value < raioX.pipeline.total * 0.1) {
      provocacoes.push(`${firstName}, o pipeline está gordo mas o caixa está magro. Quantidade sem conversão é apenas ilusão de progresso.`);
    }

    // Based on activity
    if (raioX.activitiesPending > raioX.activitiesCompleted * 2) {
      provocacoes.push(`${firstName}, o acúmulo de pendências está criando uma bola de neve. Time ocupado nem sempre é time produtivo.`);
    }

    // Based on alerts
    if (alerts.filter(a => a.type === 'danger').length > 0) {
      provocacoes.push(`${firstName}, sinais de alerta acesos. A diferença entre um mês bom e um desastre está nas decisões das próximas 48 horas.`);
    }

    // Based on ranking leader
    if (ranking.length > 0 && ranking[0].wonValue > 0) {
      provocacoes.push(`${firstName}, enquanto ${ranking[0].name.split(' ')[0]} puxa o time, onde estão os outros? Performance é contagiante - mas inércia também.`);
    }

    // Default provocations
    if (provocacoes.length === 0) {
      provocacoes.push(
        `${firstName}, números não mentem. Mas também não contam toda a história. O que seus instintos estão dizendo que os dados ainda não mostram?`,
        `${firstName}, hoje é mais um dia de manter ou de mudar? A zona de conforto nunca ganhou quota.`
      );
    }

    return provocacoes[Math.floor(Math.random() * provocacoes.length)];
  };

  useEffect(() => {
    fetchMastermindData();
  }, [organizationId]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
      <CardHeader className="pb-3 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                MASTERMIND NOID
                <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {format(new Date(data.generatedAt), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMastermindData}
            disabled={isLoading}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        {/* Raio-X do Dia */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Raio-X do Dia</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">Pipeline Ativo</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(data.raioX.pipeline.total)}</p>
              <p className="text-xs text-muted-foreground">{data.raioX.pipeline.deals} deals</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <p className="text-xs text-muted-foreground">Fechado Mês</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(data.raioX.closedMonth.value)}</p>
              <p className="text-xs text-muted-foreground">{data.raioX.closedMonth.count} deals</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-xs text-muted-foreground">Perdido Mês</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(data.raioX.lostMonth.value)}</p>
              <p className="text-xs text-muted-foreground">{data.raioX.lostMonth.count} deals</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-lg font-bold text-blue-600">{data.raioX.winRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">{data.raioX.activitiesCompleted} atividades</p>
            </div>
          </div>
        </div>

        <Separator className="bg-primary/10" />

        {/* Highlights Individuais */}
        {data.highlights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Highlights Individuais</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.highlights.map((h, i) => (
                <div 
                  key={i} 
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    h.type === 'positive' 
                      ? 'bg-green-500/5 border border-green-500/20' 
                      : h.type === 'warning'
                      ? 'bg-amber-500/5 border border-amber-500/20'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${
                    h.type === 'positive' ? 'bg-green-500/20' : 
                    h.type === 'warning' ? 'bg-amber-500/20' : 'bg-muted'
                  }`}>
                    {h.icon === 'trophy' && <Trophy className="h-3.5 w-3.5 text-green-600" />}
                    {h.icon === 'activity' && <Activity className="h-3.5 w-3.5 text-green-600" />}
                    {h.icon === 'alert' && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                    {h.icon === 'clock' && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.metric}: {h.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertas para o Time */}
        {data.alerts.length > 0 && (
          <>
            <Separator className="bg-primary/10" />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="font-semibold text-sm">Alertas para o Time</h3>
              </div>
              <div className="space-y-2">
                {data.alerts.map((alert, i) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg border ${
                      alert.type === 'danger' 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : alert.type === 'warning'
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-blue-500/5 border-blue-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-medium ${
                          alert.type === 'danger' ? 'text-red-600' : 
                          alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
                        }`}>{alert.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                      </div>
                      {alert.action && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="shrink-0 text-xs h-8 px-3 border-primary/30 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleAlertAction(alert.action!)}
                        >
                          {alert.action}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Direcionamento para o Time */}
        <Separator className="bg-primary/10" />
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Direcionamento Tático</h3>
          </div>
          <div className="space-y-2">
            {data.directions.map((dir, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
                <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{dir}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Ranking */}
        {data.ranking.length > 0 && (
          <>
            <Separator className="bg-primary/10" />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Mini Ranking do Dia</h3>
              </div>
              <div className="space-y-1.5">
                {data.ranking.map((entry) => (
                  <div 
                    key={entry.userId}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      entry.position === 1 
                        ? 'bg-amber-500/10 border border-amber-500/20' 
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      entry.position === 1 ? 'bg-amber-500 text-white' :
                      entry.position === 2 ? 'bg-gray-400 text-white' :
                      entry.position === 3 ? 'bg-amber-700 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(entry.wonValue)}</p>
                      <p className="text-xs text-muted-foreground">{entry.wonCount} deal{entry.wonCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Provocação do Dia */}
        <Separator className="bg-primary/10" />
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-primary">Provocação do Dia</h3>
          </div>
          <p className="text-sm italic text-foreground/80 leading-relaxed">
            "{data.provocacao}"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
