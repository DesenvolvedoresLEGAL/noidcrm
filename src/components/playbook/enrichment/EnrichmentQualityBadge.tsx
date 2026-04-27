import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Shield, ShieldAlert, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';

type Grade = 'A' | 'B' | 'C' | 'D';

interface Props {
  grade: Grade | null | undefined;
  score?: number | null;
  className?: string;
}

const MAP: Record<Grade, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  A: {
    label: 'Qualidade A',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
  },
  B: {
    label: 'Qualidade B',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    icon: Shield,
  },
  C: {
    label: 'Qualidade C',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    icon: ShieldAlert,
  },
  D: {
    label: 'Qualidade D',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
    icon: ShieldX,
  },
};

export function EnrichmentQualityBadge({ grade, score, className }: Props) {
  if (!grade) return null;
  const cfg = MAP[grade];
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
