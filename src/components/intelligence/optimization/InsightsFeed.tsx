import { useOptimizationInsights } from '@/hooks/optimization/useOptimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  signal: 'Sinal',
  template: 'Template',
  channel: 'Canal',
  playbook: 'Playbook',
  provider: 'Provedor',
};

export function InsightsFeed() {
  const { data, isLoading } = useOptimizationInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights detectados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando insights…
          </div>
        )}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum insight ainda. Execute o ciclo de otimização para começar.
          </p>
        )}
        {data?.map((i) => {
          const positive = (i.delta ?? 0) >= 0;
          return (
            <div key={i.id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[i.insight_type] ?? i.insight_type}</Badge>
                  <span className="font-medium text-sm">{i.entity_label ?? i.entity_id}</span>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {((i.delta ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {i.metric_name}: {((i.metric_value ?? 0) * 100).toFixed(1)}% · baseline {((i.baseline_value ?? 0) * 100).toFixed(1)}% · amostra {i.sample_size} · confiança {(i.confidence_score * 100).toFixed(0)}%
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
