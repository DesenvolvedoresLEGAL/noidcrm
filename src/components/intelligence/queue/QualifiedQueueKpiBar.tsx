import { Card, CardContent } from '@/components/ui/card';
import { useQualifiedQueueKpis } from '@/hooks/intelligence/useQualifiedQueueKpis';
import { KpiBarSkeleton, PremiumKpi } from '@/components/intelligence/kairos/premium';
import type { QualifiedQueueKpis } from '@/services/intelligence/qualifiedQueue';
import {
  Inbox,
  BadgeCheck,
  Sparkles,
  ClipboardList,
  Import,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

const ITEMS: Array<{
  key: keyof QualifiedQueueKpis;
  label: string;
  suffix?: string;
  icon: LucideIcon;
  accent?: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'default';
}> = [
  { key: 'captured', label: 'Capturados', icon: Inbox, accent: 'blue' },
  { key: 'qualified', label: 'Qualificados', icon: BadgeCheck, accent: 'violet' },
  { key: 'ready_for_sdr', label: 'Prontos para SDR', icon: Sparkles, accent: 'emerald' },
  { key: 'review', label: 'Em revisão', icon: ClipboardList, accent: 'amber' },
  { key: 'imported', label: 'Importados', icon: Import, accent: 'default' },
  { key: 'discarded', label: 'Descartados', icon: Trash2, accent: 'rose' },
  { key: 'conversion_rate', label: 'Aproveitamento', suffix: '%', icon: TrendingUp, accent: 'emerald' },
];

export function QualifiedQueueKpiBar() {
  const { data, isLoading } = useQualifiedQueueKpis();

  if (isLoading) {
    return <KpiBarSkeleton count={ITEMS.length} />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {ITEMS.map(({ key, label, suffix, icon, accent }) => (
        <PremiumKpi
          key={label}
          icon={icon}
          label={label}
          value={`${data?.[key] ?? 0}${suffix ?? ''}`}
          accent={accent}
        />
      ))}
    </div>
  );
}
