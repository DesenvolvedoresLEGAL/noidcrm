import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'border-border',
  positive: 'border-emerald-500/40',
  warning: 'border-amber-500/40',
  critical: 'border-red-500/40',
};

export function PeopleSignalCard({ label, value, helper, icon: Icon, tone = 'default' }: Props) {
  return (
    <Card className={cn('border', TONE[tone])}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span className="uppercase tracking-wide">{label}</span>
        </div>
        <p className="truncate text-lg font-semibold" title={value}>
          {value}
        </p>
        {helper && <p className="truncate text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}
