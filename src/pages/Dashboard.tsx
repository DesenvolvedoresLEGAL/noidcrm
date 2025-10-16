import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Target, DollarSign } from 'lucide-react';
import { listLeads } from '@/services/crm/leads';
import { listOpportunities } from '@/services/crm/opportunities';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalOpportunities: 0,
    forecastValue: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const [leadsData, oppsData] = await Promise.all([
        listLeads(),
        listOpportunities(),
      ]);

      const forecastValue = oppsData.data.reduce(
        (sum, opp) => sum + (opp.valor_previsto || 0) * (opp.prob || 0),
        0
      );

      setStats({
        totalLeads: leadsData.total,
        totalOpportunities: oppsData.total,
        forecastValue,
        conversionRate: leadsData.total > 0 ? (oppsData.total / leadsData.total) * 100 : 0,
      });
    };

    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Leads Ativos',
      value: stats.totalLeads,
      icon: Users,
      color: 'text-primary',
    },
    {
      title: 'Oportunidades',
      value: stats.totalOpportunities,
      icon: Target,
      color: 'text-accent',
    },
    {
      title: 'Forecast',
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(stats.forecastValue),
      icon: DollarSign,
      color: 'text-secondary',
    },
    {
      title: 'Taxa de Conversão',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-primary',
    },
  ];

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do pipeline comercial
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Gráfico de funil será implementado aqui
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
