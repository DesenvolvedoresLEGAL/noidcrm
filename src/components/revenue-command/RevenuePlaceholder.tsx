import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RevenuePlaceholderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  minHeight?: string;
}

/**
 * Sprint REVOPS V3.0 — Placeholder visual reutilizável.
 * Estritamente UI: sem dados, sem lógica, sem hooks de negócio.
 */
export function RevenuePlaceholder({
  title,
  description,
  icon,
  className,
  minHeight = 'min-h-[140px]',
}: RevenuePlaceholderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-4',
        minHeight,
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <span className="mt-auto text-[10px] uppercase tracking-wide text-muted-foreground/70">
        Em construção
      </span>
    </div>
  );
}
