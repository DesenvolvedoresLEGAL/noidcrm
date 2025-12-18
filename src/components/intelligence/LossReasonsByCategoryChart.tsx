import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LossReasonsByCategoryChartProps {
  organizationId: string;
  pipelineContext: 'qualification' | 'sales' | 'onboarding';
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  price: { label: 'Preço', color: '#ef4444' },
  competition: { label: 'Concorrência', color: '#f97316' },
  timing: { label: 'Timing', color: '#eab308' },
  product: { label: 'Produto', color: '#22c55e' },
  relationship: { label: 'Relacionamento', color: '#3b82f6' },
  internal: { label: 'Interno', color: '#8b5cf6' },
  other: { label: 'Outros', color: '#6b7280' }
};

export function LossReasonsByCategoryChart({ organizationId, pipelineContext }: LossReasonsByCategoryChartProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['loss-reasons-by-category', organizationId, pipelineContext],
    queryFn: async () => {
      // Fetch loss reasons with category
      const { data: lossReasons, error } = await supabase
        .from('loss_reasons')
        .select('id, name, category')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) throw error;

      // Get pipelines by context
      const pipelineTypes = pipelineContext === 'onboarding' 
        ? ['onboarding', 'cs', 'renewal'] 
        : [pipelineContext];

      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organizationId)
        .in('pipeline_type', pipelineTypes);

      const pipelineIds = pipelines?.map(p => p.id) || [];

      // Fetch win_loss_records with losses
      const { data: records } = await supabase
        .from('win_loss_records')
        .select(`
          reason_id,
          opportunity:opportunities(pipeline_id)
        `)
        .eq('organization_id', organizationId)
        .eq('outcome', 'lost');

      // Filter by pipeline and count by reason
      const filteredRecords = records?.filter(r => 
        pipelineIds.includes((r.opportunity as any)?.pipeline_id)
      ) || [];

      // Count by reason_id
      const reasonCounts: Record<string, number> = {};
      filteredRecords.forEach(r => {
        if (r.reason_id) {
          reasonCounts[r.reason_id] = (reasonCounts[r.reason_id] || 0) + 1;
        }
      });

      // Group by category
      const categoryData: Record<string, { count: number; reasons: Array<{ name: string; count: number }> }> = {};
      
      lossReasons?.forEach(lr => {
        const category = lr.category || 'other';
        const count = reasonCounts[lr.id] || 0;
        
        if (!categoryData[category]) {
          categoryData[category] = { count: 0, reasons: [] };
        }
        
        categoryData[category].count += count;
        if (count > 0) {
          categoryData[category].reasons.push({ name: lr.name, count });
        }
      });

      // Sort reasons within each category
      Object.values(categoryData).forEach(cat => {
        cat.reasons.sort((a, b) => b.count - a.count);
      });

      // Convert to chart data
      const chartData = Object.entries(categoryData)
        .filter(([_, data]) => data.count > 0)
        .map(([category, data]) => ({
          name: CATEGORY_CONFIG[category]?.label || category,
          category,
          value: data.count,
          color: CATEGORY_CONFIG[category]?.color || '#6b7280',
          reasons: data.reasons
        }))
        .sort((a, b) => b.value - a.value);

      const total = chartData.reduce((sum, item) => sum + item.value, 0);

      return { chartData, total };
    },
    enabled: !!organizationId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
            Perdas por Categoria
          </CardTitle>
          <CardDescription>Agrupamento de motivos por tipo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <PieChartIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma perda categorizada</p>
              <p className="text-xs mt-1">Dados aparecem após perdas serem registradas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Perdas por Categoria
        </CardTitle>
        <CardDescription>Agrupamento de motivos por tipo - clique para expandir</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => setExpandedCategory(
                      expandedCategory === entry.category ? null : entry.category
                    )}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} (${Math.round((value / data.total) * 100)}%)`, 'Perdas']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Category List with Drill-down */}
          <div className="space-y-2">
            {data.chartData.map((category) => (
              <div key={category.category}>
                <button
                  onClick={() => setExpandedCategory(
                    expandedCategory === category.category ? null : category.category
                  )}
                  className="w-full p-2 rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategory === category.category ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium text-sm">{category.name}</span>
                  </div>
                  <Badge variant="secondary">
                    {category.value} ({Math.round((category.value / data.total) * 100)}%)
                  </Badge>
                </button>

                {/* Expanded reasons */}
                {expandedCategory === category.category && category.reasons.length > 0 && (
                  <div className="ml-9 mt-1 space-y-1.5 pb-2">
                    {category.reasons.map((reason, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate">{reason.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {reason.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
