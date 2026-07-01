import { motion } from 'framer-motion';
import { Brain, Sparkles, Users, ShieldCheck, Coins, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useKairosCommandKPIs } from '@/hooks/useKairosCommandKPIs';

type KPI = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string | null;
};

function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatPct(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return `${n}%`;
}

export function KairosExecutiveHeader() {
  const { data, isLoading } = useKairosCommandKPIs();

  const kpis: KPI[] = [
    { key: 'prospects', icon: Users, label: 'Prospects hoje', value: formatCount(data?.prospectsToday) },
    { key: 'sdr', icon: Sparkles, label: 'SDR Ready', value: formatCount(data?.sdrReady) },
    { key: 'coverage', icon: ShieldCheck, label: 'Cobertura média', value: formatPct(data?.coverageAvg) },
    { key: 'roi', icon: TrendingUp, label: 'Apollo ROI', value: data?.apolloRoi ? `${data.apolloRoi}x` : null },
    { key: 'revenue', icon: Coins, label: 'Receita atribuída', value: data?.attributedRevenue ? `R$ ${formatCount(data.attributedRevenue)}` : null },
    { key: 'skills', icon: Zap, label: 'Skills hoje', value: formatCount(data?.skillsToday) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-primary/5 to-transparent p-5 md:p-7"
    >
      <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
            <Brain className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Kairós</h1>
              <span className="text-xs uppercase tracking-[0.14em] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                Lead Intelligence Platform
              </span>
            </div>
            <p className="text-sm md:text-base text-muted-foreground mt-1 max-w-2xl">
              Descubra, qualifique, execute e maximize receita automaticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <motion.div
                key={k.key}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'group rounded-xl border bg-card/70 backdrop-blur-sm px-3 py-3 md:px-4 md:py-3.5',
                  'hover:border-primary/40 hover:shadow-sm transition-all',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
                    {k.label}
                  </span>
                </div>
                <div className="mt-2">
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <span className="text-xl md:text-2xl font-semibold tabular-nums">
                      {k.value ?? '—'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
