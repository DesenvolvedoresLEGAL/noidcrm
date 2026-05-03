// NRHS Distribution Charts - Gráficos de distribuição

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { NRHSTierDistribution, NRHSPillarAverage, getTierLabel } from '@/services/crm/nrhs-analytics';
import { NRHSTier } from '@/services/crm/nrhs-calculator';

interface NRHSDistributionChartsProps {
  tierDistribution: NRHSTierDistribution[];
  pillarAverages: NRHSPillarAverage[];
  isLoading: boolean;
}

const TIER_COLORS: Record<NRHSTier, string> = {
  elite: '#10b981',      // emerald-500
  healthy: '#3b82f6',    // blue-500
  risk: '#eab308',       // yellow-500
  critical: '#f97316',   // orange-500
  insalubrious: '#ef4444', // red-500
};

const PILLAR_TOOLTIPS: Record<string, string> = {
  integrity: 'Mede completude de dados essenciais como valor, data de fechamento e informações da empresa.',
  cadence: 'Avalia frequência de atividades, próximo passo definido e revisões semanais realizadas.',
  stakeholders: 'Verifica presença de decisor identificado e reuniões agendadas com stakeholders.',
  winloss: 'Analisa tempo no estágio, existência de proposta e aderência ao ciclo de vendas.',
  adherence: 'Considera opportunity score, temperatura do deal e alinhamento com processo comercial.',
};

export function NRHSDistributionCharts({ tierDistribution, pillarAverages, isLoading }: NRHSDistributionChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieData = tierDistribution
    .filter(t => t.count > 0)
    .map(t => ({
      name: getTierLabel(t.tier),
      value: t.count,
      percentage: t.percentage,
      tier: t.tier,
    }));

  const barData = pillarAverages.map(p => ({
    name: p.label,
    score: p.average,
    weight: `${p.weight}%`,
    hasAlert: p.hasAlert,
    pillar: p.pillar,
  }));

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} deals ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground mb-1">
            Score médio: {data.score} | Peso: {data.weight}
          </p>
          <p className="text-xs text-muted-foreground">
            {PILLAR_TOOLTIPS[data.pillar]}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tier Distribution Pie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            Distribuição por Faixa NRHS
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Visão geral da saúde do pipeline por faixa de NRHS</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Nenhum deal encontrado
            </div>
          ) : (
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={TIER_COLORS[entry.tier as NRHSTier]} 
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {tierDistribution.map((tier) => (
                  <div key={tier.tier} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: TIER_COLORS[tier.tier] }}
                    />
                    <span className="text-muted-foreground flex-1">{getTierLabel(tier.tier)}</span>
                    <span className="font-medium">{tier.count}</span>
                    <span className="text-muted-foreground text-xs">({tier.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pillar Averages Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            NRHS por Pilar
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Score médio de cada pilar. Pilares abaixo de 70 precisam de atenção.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 40 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={90} 
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip content={<CustomBarTooltip />} />
                <Bar 
                  dataKey="score" 
                  radius={[0, 4, 4, 0]}
                  fill="hsl(var(--primary))"
                >
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.hasAlert ? '#f97316' : 'hsl(var(--primary))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Abaixo de 70
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
