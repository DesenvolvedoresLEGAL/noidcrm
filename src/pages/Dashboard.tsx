import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Target, DollarSign, Clock, ArrowRight } from 'lucide-react';
import { listLeads } from '@/services/crm/leads';
import { listOpportunities } from '@/services/crm/opportunities';
import { listPipelines } from '@/services/crm/pipelines';
import { FunnelChart } from '@/components/FunnelChart';
import { OpportunitiesByStage } from '@/components/OpportunitiesByStage';
import { TopOpportunities } from '@/components/TopOpportunities';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalOpportunities: 0,
    forecastValue: 0,
    conversionRate: 0,
    averageTicket: 0,
    salesCycle: 0,
  });
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [stageData, setStageData] = useState<any[]>([]);
  const [goalProgress, setGoalProgress] = useState({ current: 0, target: 500000, percentage: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [leadsData, oppsData, pipelinesData] = await Promise.all([
        listLeads(),
        listOpportunities(),
        listPipelines(),
      ]);

      const allOpps = oppsData.data;
      setOpportunities(allOpps);

      // Calcular métricas
      const forecastValue = allOpps.reduce(
        (sum, opp) => sum + (opp.valor_previsto || 0) * (opp.prob || 0),
        0
      );

      const wonOpps = allOpps.filter(o => o.meta?.status === 'Ganhou');
      const averageTicket = wonOpps.length > 0
        ? wonOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) / wonOpps.length
        : 0;

      // Calcular ciclo de vendas (média de dias entre criação e fechamento)
      const salesCycle = wonOpps.length > 0
        ? wonOpps.reduce((sum, o) => {
            const created = new Date(o.created_at).getTime();
            const updated = new Date(o.updated_at).getTime();
            return sum + (updated - created) / (1000 * 60 * 60 * 24);
          }, 0) / wonOpps.length
        : 0;

      setStats({
        totalLeads: leadsData.total,
        totalOpportunities: allOpps.length,
        forecastValue,
        conversionRate: leadsData.total > 0 ? (allOpps.length / leadsData.total) * 100 : 0,
        averageTicket,
        salesCycle,
      });

      // Dados do funil
      const funnel = [
        { stage: 'Leads', count: leadsData.total, value: 0 },
        { stage: 'Oportunidades', count: allOpps.length, value: 0 },
        { stage: 'Propostas', count: allOpps.filter(o => o.stage_id?.includes('proposal')).length, value: 0 },
        { stage: 'Ganhos', count: wonOpps.length, value: 0 },
      ];
      setFunnelData(funnel);

      // Dados por estágio (agrupado por produto dinâmico)
      const stages = pipelinesData.flatMap(p => p.stages);
      const uniqueProducts = [...new Set(allOpps.map(o => o.produto).filter(Boolean))];
      const stageMap = new Map();
      
      stages.forEach(stage => {
        const stageOpps = allOpps.filter(o => o.stage_id === stage.id);
        const productValues: Record<string, number> = {};
        
        uniqueProducts.forEach(product => {
          productValues[product] = stageOpps
            .filter(o => o.produto === product)
            .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
        });

        stageMap.set(stage.name, {
          stage: stage.name,
          ...productValues
        });
      });

      setStageData(Array.from(stageMap.values()));

      // Meta vs Realizado
      const currentRevenue = wonOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      setGoalProgress({
        current: currentRevenue,
        target: 500000,
        percentage: (currentRevenue / 500000) * 100,
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleOpportunityClick = (id: string) => {
    navigate(`/opportunities?opp=${id}`);
  };

  const statCards = [
    {
      title: 'Receita Prevista (Forecast)',
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
      }).format(stats.forecastValue),
      icon: DollarSign,
      color: 'text-primary',
      description: 'Ponderado por probabilidade',
    },
    {
      title: 'Taxa de Conversão Global',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-accent',
      description: 'Leads → Oportunidades',
    },
    {
      title: 'Ticket Médio',
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
      }).format(stats.averageTicket),
      icon: Target,
      color: 'text-secondary',
      description: 'Oportunidades ganhas',
    },
    {
      title: 'Ciclo de Vendas Médio',
      value: `${Math.round(stats.salesCycle)} dias`,
      icon: Clock,
      color: 'text-primary',
      description: 'Criação → Fechamento',
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Visão estratégica do pipeline comercial
          </p>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Metas vs Realizado */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Meta Mensal vs Realizado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Realizado</p>
                <p className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                  }).format(goalProgress.current)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Meta</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                  }).format(goalProgress.target)}
                </p>
              </div>
            </div>
            <Progress value={goalProgress.percentage} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">
              {goalProgress.percentage.toFixed(1)}% da meta alcançada
            </p>
          </CardContent>
        </Card>

        {/* Funil de Vendas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FunnelChart data={funnelData} />
          <OpportunitiesByStage data={stageData} />
        </div>

        {/* Top 5 Oportunidades */}
        <TopOpportunities
          opportunities={opportunities}
          onOpportunityClick={handleOpportunityClick}
        />

        {/* Atividades Pendentes */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Próximas Atividades</CardTitle>
              <Button variant="outline" size="sm">
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade pendente no momento.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
