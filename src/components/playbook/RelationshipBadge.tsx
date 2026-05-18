import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckCircle2, Briefcase, Building2, Sparkles, HelpCircle } from 'lucide-react';

export type RelationshipStatus =
  | 'customer'
  | 'opportunity_existing'
  | 'account_existing'
  | 'new_prospect';

interface Props {
  status: RelationshipStatus | null | undefined;
  confidence?: number | null;
  reason?: string | null;
  className?: string;
  compact?: boolean;
}

const CONFIG: Record<
  RelationshipStatus,
  { label: string; icon: any; classes: string }
> = {
  customer: {
    label: 'Cliente',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  },
  opportunity_existing: {
    label: 'Em oportunidade',
    icon: Briefcase,
    classes: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  },
  account_existing: {
    label: 'Já é conta',
    icon: Building2,
    classes: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400',
  },
  new_prospect: {
    label: 'Novo',
    icon: Sparkles,
    classes: 'bg-muted text-muted-foreground border-border',
  },
};

export function RelationshipBadge({ status, confidence, reason, className, compact }: Props) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-muted-foreground', className)}>
        <HelpCircle className="h-3 w-3" />
        {compact ? '—' : 'Não verificado'}
      </Badge>
    );
  }

  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  const badge = (
    <Badge variant="outline" className={cn('gap-1 border', cfg.classes, className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
      {typeof confidence === 'number' && !compact ? (
        <span className="opacity-70 font-normal">· {confidence}%</span>
      ) : null}
    </Badge>
  );

  if (!reason) return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{badge}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <div className="font-medium">{cfg.label}</div>
          <div className="text-muted-foreground">{reason}</div>
          {typeof confidence === 'number' ? (
            <div className="text-muted-foreground mt-1">Confiança: {confidence}%</div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
