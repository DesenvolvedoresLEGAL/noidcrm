import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UnreliableMetricProps {
  className?: string;
  variant?: 'inline' | 'card' | 'compact';
}

/**
 * Sprint 2.1 — Marcador semântico para métricas que dependem de bases ainda
 * não construídas (ex.: stage_history). Diferente de <UnavailableMetric />,
 * que indica ausência de dado nesta organização específica, esta indica que
 * a métrica é estruturalmente impossível de calcular com confiança no momento.
 *
 * Mensagem fixa: "Aguardando base histórica confiável".
 */
export function UnreliableMetric({ className, variant = 'inline' }: UnreliableMetricProps) {
  const reason = 'Aguardando base histórica confiável';

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center',
          className
        )}
      >
        <Clock className="h-5 w-5 text-muted-foreground" />
        <p className="text-2xl font-semibold text-muted-foreground">—</p>
        <p className="text-xs text-muted-foreground/80">{reason}</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return <span className={cn('text-xs italic text-muted-foreground', className)}>—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm italic text-muted-foreground',
              className
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            —
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
