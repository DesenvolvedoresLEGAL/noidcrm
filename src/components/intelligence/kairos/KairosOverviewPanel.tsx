import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Target,
  Inbox,
  Coins,
  BarChart3,
  Search,
  Bot,
  Handshake,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { KairosTabId } from './kairosNavigationConfig';

interface Props {
  onNavigate: (tab: KairosTabId) => void;
}

type Shortcut = {
  tab: KairosTabId;
  title: string;
  description: string;
  icon: LucideIcon;
};

const SHORTCUTS: Shortcut[] = [
  { tab: 'sourcing', title: 'Nova busca', description: 'Capturar leads em novas fontes', icon: Search },
  { tab: 'queue', title: 'Qualified Queue', description: 'Fila de prospects prontos para SDR', icon: Inbox },
  { tab: 'autopilot', title: 'Executar Autopilot', description: 'Automações comerciais', icon: Bot },
  { tab: 'sdr-copilot', title: 'SDR Copilot', description: 'Copiloto de pré-vendas', icon: Handshake },
  { tab: 'gtm-performance', title: 'GTM Performance', description: 'Performance por canal', icon: BarChart3 },
  { tab: 'revenue-attribution', title: 'Revenue Attribution', description: 'ROI e atribuição de receita', icon: Coins },
];

const DOMAINS: { title: string; description: string; icon: LucideIcon; tabs: KairosTabId[] }[] = [
  {
    title: 'Inteligência',
    description: 'Decisão do sistema — ICP, cobertura e skills.',
    icon: Target,
    tabs: ['icp', 'coverage', 'skills'],
  },
  {
    title: 'Operação',
    description: 'Preparo e execução comercial.',
    icon: Handshake,
    tabs: ['sourcing', 'queue', 'autopilot', 'sdr-copilot'],
  },
  {
    title: 'Receita',
    description: 'Atribuição, performance e ROI.',
    icon: Coins,
    tabs: ['revenue-attribution', 'gtm-performance'],
  },
  {
    title: 'Laboratório',
    description: 'Testes, otimizações e aprendizado.',
    icon: Sparkles,
    tabs: ['optimization', 'experiments', 'performance'],
  },
];

import { KairosCommandCenter } from './KairosCommandCenter';

export function KairosOverviewPanel({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <KairosCommandCenter onNavigate={onNavigate} />

      <Card className="rounded-xl transition-shadow hover:shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Kairós — Visão Geral</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hub de inteligência GTM. Prepare, priorize e mensure receita em um só lugar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SHORTCUTS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.tab}
                  type="button"
                  onClick={() => onNavigate(s.tab)}
                  className="group text-left rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 text-primary p-2">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        {s.title}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {DOMAINS.map((d) => {
          const Icon = d.icon;
          return (
            <Card key={d.title}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="rounded-md bg-primary/10 text-primary p-2">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {d.tabs.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(t)}
                    className="h-8"
                  >
                    {t.replace('-', ' ')}
                  </Button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface CoverageInfoProps {
  onNavigate: (tab: KairosTabId) => void;
}

export function KairosSmartCoverageOverview({ onNavigate }: CoverageInfoProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="rounded-md bg-primary/10 text-primary p-2">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <CardTitle className="text-lg">Smart Coverage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Antes de gastar créditos Apollo, o Kairós checa a cobertura de dados do prospect (Conta,
            Contato, Decisor, Telefone, WhatsApp, Oportunidade, Proposta, Receita). Score ≥ 90 bloqueia
            enriquecimento redundante.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          A análise acontece por prospect — abra a Qualified Queue para inspecionar cobertura em cada
          card e decidir se vale gastar Apollo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onNavigate('queue')}>
            <Inbox className="h-4 w-4" /> Abrir Qualified Queue
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('sourcing')}>
            <Search className="h-4 w-4" /> Sourcing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
