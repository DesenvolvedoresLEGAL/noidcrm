import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldRowProps {
  label: string;
  value: string | number | ReactNode;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function FieldRow({ label, value, icon, className, valueClassName }: FieldRowProps) {
  return (
    <div className={cn('flex items-start gap-1.5 overflow-hidden', className)}>
      {icon && <span className="text-muted-foreground mt-0.5 flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <div className="flex-1 min-w-0 overflow-hidden">
        <span className="text-muted-foreground text-[11px] leading-tight block">{label}</span>
        <div className={cn('text-xs font-medium leading-snug truncate', valueClassName)}>
          {value}
        </div>
      </div>
    </div>
  );
}
