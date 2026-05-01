import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Activity, ListChecks, ShieldAlert, UserCog, CalendarRange } from 'lucide-react';
import type { ForecastQuickActionV2, RiskActionType } from '@/types/forecast-risk-center';
import { cn } from '@/lib/utils';

interface Props {
  actions: ForecastQuickActionV2[];
}

const ICONS: Record<RiskActionType, any> = {
  fix_expired_close_date: CalendarRange,
  reactivate_stale_deals: Activity,
  define_next_steps: ListChecks,
  review_contaminated_realistic: ShieldAlert,
  coach_risky_seller: UserCog,
  move_slipping_to_next_month: CalendarRange,
  manager_decision_required: ShieldAlert,
  priority_follow_up: Activity,
  fix_slipping: CalendarRange,
  fix_hygiene: Wrench,
  improve_nrhs: Wrench,
};

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function priorityClass(p: string): string {
  switch (p) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function RiskQuickActions({ actions }: Props) {
  if (!actions?.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {actions.map((a) => {
        const Icon = ICONS[a.action_type] ?? Wrench;
        const disabled = (a.deals_count ?? 0) === 0;
        return (
          <Card key={a.action_type} className={cn('border', disabled && 'opacity-60')}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{a.title}</span>
                </div>
                <Badge variant="outline" className={priorityClass(a.priority)}>{a.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{a.deals_count} deals</span>
                <span className="font-semibold tabular-nums">{fmtBRL(a.amount)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
