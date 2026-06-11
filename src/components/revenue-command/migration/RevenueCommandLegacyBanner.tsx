/**
 * Sprint RCC V3.9 — Banner não-bloqueante em telas legadas, indicando que a
 * leitura executiva agora vive no Revenue Command Center.
 */
import { Link } from 'react-router-dom';
import { Radar, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  rccTab?: string;
  message?: string;
  className?: string;
}

export function RevenueCommandLegacyBanner({
  rccTab,
  message,
  className,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const defaultMessage =
    'Esta visão executiva agora também está disponível no Revenue Command Center.';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Radar className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{message ?? defaultMessage}</p>
          {rccTab && (
            <p className="text-xs text-muted-foreground">
              Veja a leitura consolidada em <strong>{rccTab}</strong>.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <Button asChild size="sm" variant="default">
          <Link to="/app/revenue-command">
            Abrir Revenue Command
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setDismissed(true)}
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
