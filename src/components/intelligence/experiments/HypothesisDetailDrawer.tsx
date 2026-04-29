import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { useVariants, useResults } from '@/hooks/experiments/useExperiments';
import type { ExperimentHypothesis } from '@/services/experiments/experimentsService';

export function HypothesisDetailDrawer({
  hypothesis,
  onClose,
}: {
  hypothesis: ExperimentHypothesis | null;
  onClose: () => void;
}) {
  const { data: variants } = useVariants(hypothesis?.id);
  const { data: results } = useResults(hypothesis?.id);

  const open = !!hypothesis;
  const resultsByVariant = new Map((results ?? []).map((r) => [r.variant_id, r]));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{hypothesis?.description}</SheetTitle>
          <SheetDescription>
            {hypothesis && (
              <span className="space-x-2">
                <Badge variant="secondary">{hypothesis.hypothesis_type}</Badge>
                <Badge>{hypothesis.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  Alvo: {hypothesis.target_entity}
                </span>
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {(variants?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              {hypothesis?.status === 'pending'
                ? 'Aprove a hipótese para gerar variantes.'
                : 'Variantes ainda não disponíveis.'}
            </p>
          )}
          {variants?.map((v) => {
            const r = resultsByVariant.get(v.id);
            const isWinner = hypothesis?.winner_variant_id === v.id;
            const content = v.content as any;
            return (
              <div
                key={v.id}
                className={`rounded-md border p-3 space-y-2 ${isWinner ? 'border-emerald-500 ring-1 ring-emerald-500/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.is_control ? 'outline' : 'secondary'}>
                      Variante {v.variant_label}
                    </Badge>
                    {v.is_control && <span className="text-xs text-muted-foreground">Controle</span>}
                    {isWinner && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <Trophy className="h-3 w-3 mr-1" /> Vencedor
                      </Badge>
                    )}
                    {content?.approach && (
                      <Badge variant="outline" className="text-xs">{content.approach}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{v.allocation_percentage}% alocação</span>
                </div>
                {content?.subject && (
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Assunto</div>
                    <div className="font-medium">{String(content.subject)}</div>
                  </div>
                )}
                {content?.body && (
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Corpo</div>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-2 rounded">
                      {String(content.body)}
                    </pre>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                  <Metric label="Envios" value={r?.sent ?? 0} />
                  <Metric label="Reply" value={`${((r?.reply_rate ?? 0) * 100).toFixed(1)}%`} />
                  <Metric label="Meeting" value={`${((r?.meeting_rate ?? 0) * 100).toFixed(1)}%`} />
                  <Metric label="Win" value={`${((r?.win_rate ?? 0) * 100).toFixed(1)}%`} />
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-muted/40 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
