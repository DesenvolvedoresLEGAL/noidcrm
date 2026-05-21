/**
 * P0 Revenue SSoT — banner unificado.
 * Variantes:
 *  - `migrated`: confirma que a tela lê de commercial_won_revenue_view.
 *  - `legacy`:   alerta que a tela ainda não usa a fonte oficial.
 */
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RevenueSsotBannerProps {
  variant?: 'migrated' | 'legacy';
  surface?: string;
  className?: string;
}

export function RevenueSsotBanner({ variant = 'migrated', surface, className }: RevenueSsotBannerProps) {
  if (variant === 'legacy') {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs',
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-amber-700 dark:text-amber-300">
          Esta tela ainda não usa a fonte oficial de receita.
          {surface ? ` (${surface})` : null}
        </span>
      </div>
    );
  }
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs',
        className,
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <span className="text-emerald-700 dark:text-emerald-300">
        Receita ganha consolidada de <strong>commercial_won_revenue_view</strong> (fonte oficial).
        {surface ? ` · ${surface}` : null}
      </span>
    </div>
  );
}
