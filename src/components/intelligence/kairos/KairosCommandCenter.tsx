import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Check,
  Bot,
  Phone,
  ShieldCheck,
  Search,
  BarChart3,
  Inbox,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useKairosCommandKPIs } from '@/hooks/useKairosCommandKPIs';
import type { KairosTabId } from './kairosNavigationConfig';

interface Props {
  onNavigate: (tab: KairosTabId) => void;
}

type Fact = { icon: LucideIcon; label: string; value: string | null; loading?: boolean };

function fmt(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function KairosCommandCenter({ onNavigate }: Props) {
  const { data, isLoading } = useKairosCommandKPIs();

  const facts: Fact[] = [
    { icon: Search, label: 'prospects encontrados', value: fmt(data?.prospectsToday) },
    { icon: Sparkles, label: 'SDR Ready', value: fmt(data?.sdrReady) },
    { icon: ShieldCheck, label: '% cobertura média', value: data?.coverageAvg != null ? `${data.coverageAvg}%` : null },
    { icon: Bot, label: 'skills executadas', value: fmt(data?.skillsToday) },
  ];

  type Action = {
    id: string;
    title: string;
    priority: 'alta' | 'média' | 'baixa';
    icon: LucideIcon;
    tab: KairosTabId;
    cta: string;
  };

  const actions: Action[] = [
    { id: 'autopilot', title: 'Executar Autopilot em novos lotes', priority: 'alta', icon: Bot, tab: 'autopilot', cta: 'Abrir Autopilot' },
    { id: 'reveal', title: 'Revelar telefones com Apollo governado', priority: 'alta', icon: Phone, tab: 'queue', cta: 'Ir para Queue' },
    { id: 'review', title: 'Revisar prospects em human review', priority: 'média', icon: Inbox, tab: 'queue', cta: 'Ver revisão' },
    { id: 'coverage', title: 'Rodar Smart Coverage antes de gastar Apollo', priority: 'média', icon: ShieldCheck, tab: 'coverage', cta: 'Abrir Coverage' },
    { id: 'gtm', title: 'Atualizar GTM Performance', priority: 'baixa', icon: BarChart3, tab: 'gtm-performance', cta: 'Ver performance' },
  ];

  const priorityStyle: Record<Action['priority'], string> = {
    alta: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    'média': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    baixa: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2 rounded-xl transition-shadow hover:shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Hoje no GTM</CardTitle>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Live</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {facts.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2.5"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="flex-1 flex items-baseline gap-1.5 min-w-0">
                  {isLoading ? (
                    <Skeleton className="h-4 w-10" />
                  ) : (
                    <span className="text-lg font-semibold tabular-nums">
                      {f.value ?? '—'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground truncate">{f.label}</span>
                </div>
                <Check className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden />
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 rounded-xl transition-shadow hover:shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Próximas ações recomendadas</CardTitle>
            <span className="text-xs text-muted-foreground">Priorizadas</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <motion.button
                key={a.id}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={() => onNavigate(a.tab)}
                className="group w-full text-left flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2.5 hover:border-primary/40 hover:bg-accent/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 border ${priorityStyle[a.priority]}`}
                    >
                      {a.priority}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  {a.cta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </div>
              </motion.button>
            );
          })}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('sourcing')} className="w-full">
              Nova Busca de leads
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
