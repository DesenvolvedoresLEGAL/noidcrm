import { useAutopilotKpis } from '@/hooks/intelligence/useAutopilot';
import { KpiBarSkeleton, PremiumKpi } from '@/components/intelligence/kairos/premium';
import { Play, CheckCircle2, Users, Sparkles, Coins, TrendingUp } from 'lucide-react';

export function AutopilotKpiBar() {
  const { data, isLoading } = useAutopilotKpis();

  if (isLoading) return <KpiBarSkeleton count={6} />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <PremiumKpi icon={Play} label="Execuções" value={data?.total_runs ?? 0} accent="blue" />
      <PremiumKpi icon={Sparkles} label="Em execução" value={data?.running ?? 0} accent="violet" />
      <PremiumKpi icon={Users} label="Prospects processados" value={data?.total_processed ?? 0} />
      <PremiumKpi icon={CheckCircle2} label="SDR Ready" value={data?.total_sdr_ready ?? 0} accent="emerald" />
      <PremiumKpi icon={Coins} label="Créditos usados" value={data?.total_credits_used ?? 0} accent="amber" />
      <PremiumKpi icon={TrendingUp} label="Aproveitamento" value={`${data?.avg_yield ?? 0}%`} accent="emerald" />
    </div>
  );
}
