import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { CloserListItemRow } from './CloserListItemRow';
import type { CloserListItem } from '@/types/dashboard/closer';

export function CloserRiskDealsList({ deals }: { deals: CloserListItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Deals em risco</CardTitle>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Como o risco é calculado"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Risco calculado por sinais comerciais como silêncio, proposta sem resposta,
                  follow up vencido ou tempo parado na etapa.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground">
          Oportunidades que podem escapar se ninguém agir.
        </p>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum deal crítico detectado neste momento.
          </p>
        ) : (
          <ul className="divide-y">
            {deals.map((d) => (
              <CloserListItemRow key={`${d.kind}-${d.id}`} item={d} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
