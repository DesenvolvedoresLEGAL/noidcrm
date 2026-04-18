import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UnavailableMetricProps {
  reason?: string;
  className?: string;
  variant?: 'inline' | 'card' | 'compact';
}

/**
 * Sprint 2.1 — Canonical "Indisponível" placeholder.
 *
 * Use this WHENEVER a metric does not have a real, verifiable source of truth.
 * Never render fake numbers, Math.random(), or hardcoded fallbacks.
 *
 * Example:
 *   {avgDaysInStage === null
 *     ? <UnavailableMetric reason="Histórico de etapas será apurado a partir da Sprint 3" />
 *     : <span>{avgDaysInStage} dias</span>}
 */
export function UnavailableMetric({
  reason = 'Dados ainda não disponíveis nesta organização.',
  className,
  variant = 'inline',
}: UnavailableMetricProps) {
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center',
          className
        )}
      >
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Indisponível</p>
        <p className="text-xs text-muted-foreground/80">{reason}</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span className={cn('text-xs italic text-muted-foreground', className)}>—</span>
    );
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
            <AlertCircle className="h-3.5 w-3.5" />
            Indisponível
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
