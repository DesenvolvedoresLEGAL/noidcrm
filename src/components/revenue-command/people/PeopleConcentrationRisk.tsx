import { PieChart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { PeopleConcentration } from '@/hooks/revenue-command/useRevenuePeople';

const LEVEL_STYLE: Record<PeopleConcentration['level'], string> = {
  healthy: 'border-emerald-500/40 bg-emerald-500/5',
  info: 'border-blue-500/40 bg-blue-500/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  critical: 'border-red-500/40 bg-red-500/5',
};

export function PeopleConcentrationRisk({ concentration }: { concentration: PeopleConcentration }) {
  return (
    <RevenueSectionCard
      title="Concentração e dependência"
      description="Risco de a operação depender de poucas pessoas."
      icon={PieChart}
    >
      <Alert className={cn(LEVEL_STYLE[concentration.level])}>
        <AlertTitle className="text-sm">
          {concentration.top1Pct !== null
            ? `Top 1: ${concentration.top1Pct.toFixed(0)}% · Top 3: ${concentration.top3Pct?.toFixed(0) ?? '—'}%`
            : 'Sem receita válida no período'}
        </AlertTitle>
        <AlertDescription className="text-xs">{concentration.message}</AlertDescription>
      </Alert>
    </RevenueSectionCard>
  );
}
