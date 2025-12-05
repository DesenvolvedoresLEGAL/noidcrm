import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversionRateData } from '@/hooks/useReportsData';
import { Percent, ArrowRight, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import { EmptyState } from '@/components/EmptyState';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ConversionRate() {
  const { data: pipelines, isLoading, error } = useConversionRateData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Percent}
        title="Erro ao carregar dados"
        description="Não foi possível carregar as taxas de conversão."
      />
    );
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        title="Nenhuma taxa de conversão disponível"
        description="As taxas de conversão entre estágios aparecerão aqui quando você processar oportunidades pelo funil."
      />
    );
  }

  // Check if there's actual data
  const hasData = pipelines.some(p => p.stages.some(s => s.count > 0));
  
  if (!hasData) {
    return (
      <EmptyState
        icon={Percent}
        title="Nenhuma taxa de conversão disponível"
        description="As taxas de conversão entre estágios aparecerão aqui quando você processar oportunidades pelo funil."
      />
    );
  }

  return (
    <div className="space-y-6">
      {pipelines.map(pipeline => {
        const stagesWithData = pipeline.stages.filter(s => s.count > 0 || s.value > 0);
        
        if (stagesWithData.length === 0 && pipeline.stages.length === 0) return null;

        const funnelData = pipeline.stages.map((stage, i) => ({
          name: stage.stage_name,
          value: stage.count || 0,
          fill: COLORS[i % COLORS.length],
        }));

        const conversionData = pipeline.stages
          .filter(s => s.conversion_rate !== null)
          .map(s => ({
            name: s.stage_name.length > 12 ? s.stage_name.substring(0, 12) + '...' : s.stage_name,
            fullName: s.stage_name,
            taxa: s.conversion_rate || 0,
          }));

        return (
          <Card key={pipeline.pipeline_id} className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                {pipeline.pipeline_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Funnel Visualization */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Funil de Conversão</h4>
                  <div className="space-y-2">
                    {pipeline.stages.map((stage, i) => {
                      const maxCount = Math.max(...pipeline.stages.map(s => s.count || 1));
                      const width = maxCount > 0 ? Math.max(20, ((stage.count || 0) / maxCount) * 100) : 20;
                      
                      return (
                        <div key={stage.stage_id} className="flex items-center gap-3">
                          <div className="w-24 text-xs text-muted-foreground truncate" title={stage.stage_name}>
                            {stage.stage_name}
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <div 
                              className="h-8 rounded flex items-center justify-end px-2 transition-all"
                              style={{ 
                                width: `${width}%`, 
                                backgroundColor: COLORS[i % COLORS.length],
                                minWidth: '40px'
                              }}
                            >
                              <span className="text-xs font-medium text-white">{stage.count}</span>
                            </div>
                            {i < pipeline.stages.length - 1 && stage.conversion_rate !== null && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowRight className="h-3 w-3" />
                                <span>{stage.conversion_rate?.toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conversion Rates Bar Chart */}
                {conversionData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Taxa de Conversão por Estágio</h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversionData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <YAxis 
                            tickFormatter={(v) => `${v}%`}
                            domain={[0, 100]}
                            tick={{ fontSize: 10 }} 
                            className="fill-muted-foreground"
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Conversão']}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="taxa" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Stage Details Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Estágio</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Oportunidades</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Conversão → Próximo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.stages.map((stage, i) => (
                      <tr key={stage.stage_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="font-medium">{stage.stage_name}</span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-3">{stage.count}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(stage.value)}</td>
                        <td className="text-right py-2 px-3">
                          {stage.conversion_rate !== null ? (
                            <span className={stage.conversion_rate >= 50 ? 'text-emerald-500' : 'text-amber-500'}>
                              {stage.conversion_rate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
