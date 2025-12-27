import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, BarChart3, Info } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface OpportunityScoreDistributionProps {
  scoreDistribution: Array<{ range: string; label: string; count: number; color: string }>;
  averageScore: number;
  averageWinProbability: number;
  isLoading: boolean;
}

export function OpportunityScoreDistribution({ scoreDistribution, averageScore, averageWinProbability, isLoading }: OpportunityScoreDistributionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  const total = scoreDistribution.reduce((sum, g) => sum + g.count, 0);

  const metricsData = [
    { name: 'Opp Score', score: averageScore, fill: '#10b981' },
    { name: 'AI Win %', score: averageWinProbability, fill: '#8b5cf6' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Score Distribution Pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Distribuição por Score
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Distribuição de oportunidades por faixa de Opportunity Score</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={scoreDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count" nameKey="range" label={({ range, count }) => `${range}: ${count}`}>
                  {scoreDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <RechartsTooltip formatter={(value: number, name: string) => [`${value} opps (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]} />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Métricas Médias
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Como funciona?</p>
                <p className="text-xs">Opportunity Score combina Engagement, Velocity e Risk.</p>
                <p className="text-xs mt-1">AI Win Probability usa machine learning para prever chance de fechamento.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metricsData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={80} />
                <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Média']} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: number) => `${v}%` }}>
                  {metricsData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <div className="text-2xl font-bold text-emerald-600">{averageScore}</div>
              <div className="text-xs text-muted-foreground">Opp Score Médio</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10">
              <div className="text-2xl font-bold text-purple-600">{averageWinProbability}%</div>
              <div className="text-xs text-muted-foreground">AI Win Probability</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
