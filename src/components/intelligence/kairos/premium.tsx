import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared premium UI primitives for Kairós child modules.
 * Matches the Overview / Command Center visual language:
 * - rounded-xl cards with subtle hover shadow
 * - restrained icon pills, tabular-nums KPIs
 * - motion.div fade-in with 150ms ease
 * - Skeleton loaders (never spinners) for numeric surfaces
 */

interface ModuleHeaderProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  accent?: 'primary' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
}

const ACCENT_BG: Record<NonNullable<ModuleHeaderProps['accent']>, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function ModuleHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  accent = 'primary',
}: ModuleHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
            ACCENT_BG[accent],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h2 className="text-lg md:text-xl font-semibold tracking-tight leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </motion.div>
  );
}

interface PremiumKpiProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  loading?: boolean;
  accent?: 'default' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
}

const KPI_ACCENT: Record<NonNullable<PremiumKpiProps['accent']>, string> = {
  default: 'bg-muted text-muted-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function PremiumKpi({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  accent = 'default',
}: PremiumKpiProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <Card className="rounded-xl transition-shadow hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{label}</span>
            <div
              className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                KPI_ACCENT[accent],
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-1.5 text-2xl font-semibold tabular-nums leading-tight">
              {value}
            </div>
          )}
          {hint && !loading && (
            <div className="mt-1 text-[11px] text-muted-foreground truncate">{hint}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface PremiumEmptyProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PremiumEmpty({ icon: Icon, title, description, action }: PremiumEmptyProps) {
  return (
    <Card className="rounded-xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-14 px-6">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="text-base font-semibold">{title}</div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function KpiBarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-3 w-3/4" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
