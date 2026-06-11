import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { QualifiedQueueItem } from '@/services/intelligence/qualifiedQueue';
import { usePromoteToCrm } from '@/hooks/intelligence/useQualifiedQueueActions';

interface Brief {
  dores?: string[];
  hipoteses?: string[];
  angulo?: string;
  mensagem?: string;
  cta?: string;
}

interface Props {
  item: QualifiedQueueItem | null;
  onClose: () => void;
}

export function ApproachBriefDrawer({ item, onClose }: Props) {
  const promote = usePromoteToCrm();
  if (!item) return null;
  const brief = (item.approach_brief ?? {}) as Brief;
  const canPromote = item.qualification_status === 'ready_for_sdr' || item.sdr_ready;

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item.company_name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          {brief.angulo && (
            <section>
              <div className="font-semibold mb-1">Ângulo de abordagem</div>
              <p className="text-muted-foreground">{brief.angulo}</p>
            </section>
          )}
          {brief.dores && brief.dores.length > 0 && (
            <section>
              <div className="font-semibold mb-1">Dores prováveis</div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                {brief.dores.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}
          {brief.hipoteses && brief.hipoteses.length > 0 && (
            <section>
              <div className="font-semibold mb-1">Hipóteses</div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                {brief.hipoteses.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}
          {brief.mensagem && (
            <section>
              <div className="font-semibold mb-1">Mensagem sugerida</div>
              <p className="whitespace-pre-wrap rounded-md border p-3 bg-muted/30">{brief.mensagem}</p>
            </section>
          )}
          {brief.cta && (
            <section>
              <div className="font-semibold mb-1">CTA sugerido</div>
              <p className="text-muted-foreground">{brief.cta}</p>
            </section>
          )}
          {!brief.angulo && !brief.mensagem && (
            <div className="text-muted-foreground">Nenhum brief gerado ainda. Use a ação "Gerar brief de abordagem".</div>
          )}
          <div className="pt-4 border-t">
            <Button
              className="w-full"
              disabled={!canPromote}
              onClick={() => promote.mutate(item, { onSuccess: onClose })}
            >
              Enviar para SDR (promover ao CRM)
            </Button>
            {!canPromote && (
              <p className="text-xs text-muted-foreground mt-2">
                A promoção requer status <strong>Pronto para SDR</strong> (enriquecimento + decisor + contato + score ≥ 60).
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
