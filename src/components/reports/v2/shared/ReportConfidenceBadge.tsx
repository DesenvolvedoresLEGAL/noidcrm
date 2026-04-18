/**
 * Sprint 2.7 — Badge de confiança canônico para relatórios V2.
 */
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, ShieldQuestion, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/types/reportEdgeV2';

interface Props {
  level: ConfidenceLevel | null | undefined;
  score?: number | null;
  className?: string;
}

const MAP: Record<
  ConfidenceLevel,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  high: {
    label: 'Confiável',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
  },
  medium: {
    label: 'Parcial',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Shield,
  },
  partial: {
    label: 'Parcial',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Shield,
  },
  low: {
    label: 'Atenção',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    icon: ShieldAlert,
  },
  unavailable: {
    label: 'Indisponível',
    className: 'bg-muted text-muted-foreground border-border',
    icon: ShieldQuestion,
  },
};

export function ReportConfidenceBadge({ level, score, className }: Props) {
  const cfg = MAP[level ?? 'unavailable'] ?? MAP.unavailable;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', cfg.className, className)}>
      <Icon className="h-3 w-3" />
      <span>{cfg.label}</span>
      {typeof score === 'number' && Number.isFinite(score) && (
        <span className="opacity-70">· {Math.round(score)}%</span>
      )}
    </Badge>
  );
}
