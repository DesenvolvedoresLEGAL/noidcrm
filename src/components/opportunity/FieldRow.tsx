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
    <div className={cn('flex items-start gap-2', className)}>
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground text-xs">{label}</span>
        <div className={cn('font-medium break-words', valueClassName)}>
          {value}
        </div>
      </div>
    </div>
  );
}
