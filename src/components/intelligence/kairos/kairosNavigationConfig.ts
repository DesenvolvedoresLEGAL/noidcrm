import {
  LayoutDashboard,
  Brain,
  Rocket,
  LineChart,
  FlaskConical,
  Target,
  ShieldCheck,
  Sparkles,
  Search,
  Inbox,
  Bot,
  Handshake,
  Coins,
  BarChart3,
  Zap,
  TestTube,
  Activity,
  type LucideIcon,
} from 'lucide-react';

export type KairosTabId =
  | 'overview'
  | 'icp'
  | 'coverage'
  | 'skills'
  | 'sourcing'
  | 'queue'
  | 'autopilot'
  | 'sdr-copilot'
  | 'revenue-attribution'
  | 'gtm-performance'
  | 'optimization'
  | 'experiments'
  | 'performance';

export type KairosNavItem = {
  tab: KairosTabId;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type KairosNavGroup =
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      type: 'single';
      tab: KairosTabId;
    }
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      type: 'group';
      items: KairosNavItem[];
    };

export const kairosNavigationConfig: KairosNavGroup[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: LayoutDashboard,
    type: 'single',
    tab: 'overview',
  },
  {
    id: 'intelligence',
    label: 'Inteligência',
    icon: Brain,
    type: 'group',
    items: [
      { tab: 'icp', label: 'ICP Intelligence', icon: Target, description: 'Perfil ideal de cliente' },
      { tab: 'coverage', label: 'Smart Coverage', icon: ShieldCheck, description: 'Cobertura de dados antes do Apollo' },
      { tab: 'skills', label: 'Skills', icon: Sparkles, description: 'Habilidades reutilizáveis do sistema' },
    ],
  },
  {
    id: 'operations',
    label: 'Operação',
    icon: Rocket,
    type: 'group',
    items: [
      { tab: 'sourcing', label: 'Sourcing', icon: Search, description: 'Captura de leads' },
      { tab: 'queue', label: 'Qualified Queue', icon: Inbox, description: 'Fila qualificada para SDR' },
      { tab: 'autopilot', label: 'Autopilot', icon: Bot, description: 'Automações comerciais' },
      { tab: 'sdr-copilot', label: 'SDR Copilot', icon: Handshake, description: 'Copiloto para pré-vendas' },
    ],
  },
  {
    id: 'revenue',
    label: 'Receita',
    icon: LineChart,
    type: 'group',
    items: [
      { tab: 'revenue-attribution', label: 'Revenue Attribution', icon: Coins, description: 'Atribuição de receita' },
      { tab: 'gtm-performance', label: 'GTM Performance', icon: BarChart3, description: 'Performance de canais' },
    ],
  },
  {
    id: 'lab',
    label: 'Laboratório',
    icon: FlaskConical,
    type: 'group',
    items: [
      { tab: 'optimization', label: 'Optimization', icon: Zap, description: 'Otimizações recomendadas' },
      { tab: 'experiments', label: 'Experiments', icon: TestTube, description: 'Experimentos controlados' },
      { tab: 'performance', label: 'Performance', icon: Activity, description: 'Métricas de playbooks' },
    ],
  },
];

/**
 * Aliases mantêm URLs antigas funcionando (?tab=sdr, ?tab=revenue, ?tab=gtm).
 */
export const KAIROS_TAB_ALIASES: Record<string, KairosTabId> = {
  sdr: 'sdr-copilot',
  revenue: 'revenue-attribution',
  gtm: 'gtm-performance',
  icp: 'icp',
  overview: 'overview',
};

export const KAIROS_ALL_TABS: KairosTabId[] = kairosNavigationConfig.flatMap((g) =>
  g.type === 'single' ? [g.tab] : g.items.map((i) => i.tab),
);

export function resolveKairosTab(raw: string | null | undefined): KairosTabId {
  if (!raw) return 'overview';
  if ((KAIROS_ALL_TABS as string[]).includes(raw)) return raw as KairosTabId;
  if (KAIROS_TAB_ALIASES[raw]) return KAIROS_TAB_ALIASES[raw];
  return 'overview';
}

export function findGroupForTab(tab: KairosTabId): KairosNavGroup | undefined {
  return kairosNavigationConfig.find((g) =>
    g.type === 'single' ? g.tab === tab : g.items.some((i) => i.tab === tab),
  );
}

export function findItemForTab(tab: KairosTabId): KairosNavItem | undefined {
  for (const g of kairosNavigationConfig) {
    if (g.type === 'group') {
      const found = g.items.find((i) => i.tab === tab);
      if (found) return found;
    }
  }
  return undefined;
}
