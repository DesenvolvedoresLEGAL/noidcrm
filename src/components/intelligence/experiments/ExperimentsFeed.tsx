import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FlaskConical, Trophy, Check, X } from 'lucide-react';
import { useHypotheses, useApproveHypothesis, useRejectHypothesis } from '@/hooks/experiments/useExperiments';
import type { ExperimentHypothesis, HypothesisStatus } from '@/services/experiments/experimentsService';
import { HypothesisDetailDrawer } from './HypothesisDetailDrawer';

const TYPE_LABEL: Record<string, string> = {
  template: 'Template',
  channel: 'Canal',
  timing: 'Timing',
  icp: 'ICP',
};

const STATUS_VARIANT: Record<HypothesisStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  running: 'default',
  completed: 'default',
  rejected: 'outline',
  promoted: 'default',
};

export function ExperimentsFeed() {
  const { data, isLoading } = useHypotheses();
  const approve = useApproveHypothesis();
  const reject = useRejectHypothesis();
  const [selected, setSelected] = useState<ExperimentHypothesis | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" /> Experimentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum experimento ainda. Ative em Guardrails e execute o ciclo de otimização.
          </p>
        )}
        {data?.map((h) => (
          <div
            key={h.id}
            className="rounded-md border p-3 space-y-2 hover:bg-accent/40 cursor-pointer transition-colors"
            onClick={() => setSelected(h)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[h.hypothesis_type] ?? h.hypothesis_type}</Badge>
                  <Badge variant={STATUS_VARIANT[h.status]}>{h.status}</Badge>
                  {h.status === 'promoted' && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Trophy className="h-3 w-3 mr-1" /> Promovida
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{h.description}</p>
                <p className="text-xs text-muted-foreground">
                  Origem: {h.created_by === 'system' ? 'sistema' : 'usuário'} · confiança {(h.confidence_score * 100).toFixed(0)}% · {new Date(h.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            {h.status === 'pending' && (
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" onClick={() => approve.mutate(h.id)} disabled={approve.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const reason = prompt('Motivo (opcional):') ?? undefined;
                    reject.mutate({ id: h.id, reason });
                  }}
                  disabled={reject.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>

      <HypothesisDetailDrawer hypothesis={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
