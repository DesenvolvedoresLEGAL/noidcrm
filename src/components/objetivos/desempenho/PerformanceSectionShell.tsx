import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: 'primary' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'teal';
  children: ReactNode;
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  indigo: 'bg-indigo-500/10 text-indigo-600',
  amber: 'bg-amber-500/10 text-amber-600',
  rose: 'bg-rose-500/10 text-rose-600',
  teal: 'bg-teal-500/10 text-teal-600',
};

/**
 * Wraps a reused report wrapper inside a native "Desempenho" frame so the experience
 * doesn't look like a copy of the Relatórios menu. Reuse-but-reframe pattern.
 */
export function PerformanceSectionShell({ icon: Icon, title, description, accent = 'indigo', children }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
      <div>{children}</div>
    </div>
  );
}
