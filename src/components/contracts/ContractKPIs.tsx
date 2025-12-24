import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck, DollarSign, TrendingUp, AlertTriangle, ShoppingBag } from 'lucide-react';

interface ContractKPIsProps {
  stats: {
    active: number;
    expiring?: number;
    renewalDue?: number;
    totalActiveValue?: number;
    oneTimeSales?: number;
    mrr: number;
    renewalRate: number;
  };
}

export function ContractKPIs({ stats }: ContractKPIsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const kpis = [
    {
      title: 'Contratos Ativos',
      value: stats.active,
      icon: FileCheck,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Vendas Avulsas',
      value: formatCurrency(stats.oneTimeSales || 0),
      icon: ShoppingBag,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'MRR',
      value: formatCurrency(stats.mrr),
      subtitle: 'Receita Recorrente Mensal',
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Taxa de Renovação',
      value: `${stats.renewalRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Expirando em Breve',
      value: stats.renewalDue ?? stats.expiring ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
