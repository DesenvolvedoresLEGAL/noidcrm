import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodayAction } from '@/hooks/revenue-command/useRevenueTodayCommand';

const PRIORITY: Record<TodayAction['priority'], string> = {
  alta: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
  média: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  baixa: 'bg-muted text-muted-foreground border-border',
};

export function RevenueCommandActionCard({ action }: { action: TodayAction }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">{action.title}</h4>
              <p className="text-xs text-muted-foreground">{action.reason}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px] capitalize', PRIORITY[action.priority])}>
            {action.priority}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pendente</span>
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Ir para ação
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
