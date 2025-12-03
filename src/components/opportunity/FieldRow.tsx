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
    <div className={cn('flex items-start gap-1.5', className)}>
      {icon && <span className="text-muted-foreground mt-0.5 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground text-[10px] leading-none">{label}</span>
        <div className={cn('text-xs font-medium break-words leading-tight', valueClassName)}>
          {value}
        </div>
      </div>
    </div>
  );
}
