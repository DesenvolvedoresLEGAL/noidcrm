import { useOptimizationRecommendations } from '@/hooks/optimization/useOptimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Check, X, Sparkles, Undo2 } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  score_adjustment: 'Ajuste de score',
  rule_change: 'Mudança de regra',
  template_change: 'Mudança de template',
  channel_shift: 'Troca de canal',
  playbook_change: 'Mudança de playbook',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  accepted: 'default',
  auto_applied: 'default',
  dismissed: 'outline',
  failed: 'destructive',
  rolled_back: 'outline',
};

export function RecommendationsPanel() {
  const { data, isLoading, apply, dismiss } = useOptimizationRecommendations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Recomendações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma recomendação no momento.</p>
        )}
        {data?.map((r) => (
          <div key={r.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">{TYPE_LABEL[r.recommendation_type] ?? r.recommendation_type}</Badge>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </div>
                <p className="font-medium text-sm">{r.title}</p>
                {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
              </div>
              {r.impact_estimate != null && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Impacto</div>
                  <div className="font-semibold text-sm">{Number(r.impact_estimate).toFixed(1)}</div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Confiança</span>
                <span>{(r.confidence_score * 100).toFixed(0)}%</span>
              </div>
              <Progress value={r.confidence_score * 100} className="h-1.5" />
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => apply.mutate(r.id)}
                  disabled={apply.isPending}
                >
                  <Check className="h-4 w-4 mr-1" /> Aplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismiss.mutate(r.id)}
                  disabled={dismiss.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Ignorar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
