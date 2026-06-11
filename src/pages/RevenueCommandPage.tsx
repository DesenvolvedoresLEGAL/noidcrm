import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Gauge,
  HeartPulse,
  Radar,
  Sparkles,
  Users,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { RevenueCommandHeader } from '@/components/revenue-command/RevenueCommandHeader';
import {
  RevenueCommandTabs,
  type RevenueCommandTab,
} from '@/components/revenue-command/RevenueCommandTabs';
import { RevenueSectionCard } from '@/components/revenue-command/RevenueSectionCard';
import { RevenuePlaceholder } from '@/components/revenue-command/RevenuePlaceholder';

/**
 * Sprint REVOPS V3.0 — Revenue Command Center
 *
 * Fundação visual e arquitetural. Nenhuma regra de negócio, métrica,
 * view, edge function ou cálculo é introduzido nesta sprint.
 */

const PLACEHOLDER_SECTIONS: Record<string, { title: string; description?: string }[]> = {
  hoje: [
    { title: 'Placar Executivo', description: 'KPIs do dia em uma única visão.' },
    { title: 'O que Mudou', description: 'Movimentações relevantes desde a última sessão.' },
    { title: 'Alertas', description: 'Sinais que exigem atenção imediata.' },
    { title: 'Próximas Ações', description: 'Lista priorizada de decisões pendentes.' },
  ],
  gargalos: [
    { title: 'SQL → Proposta', description: 'Conversão entre qualificação e proposta.' },
    { title: 'Proposta → Venda', description: 'Conversão final do funil comercial.' },
    { title: 'Venda → Cancelamento', description: 'Risco pós-fechamento.' },
    { title: 'Tempo Médio', description: 'Velocidade do funil por etapa.' },
  ],
  pipeline: [
    { title: 'Sem Owner', description: 'Oportunidades sem responsável atribuído.' },
    { title: 'Sem Data', description: 'Oportunidades sem previsão de fechamento.' },
    { title: 'Sem Valor', description: 'Oportunidades sem valor comercial.' },
    { title: 'Parados', description: 'Oportunidades estagnadas há muito tempo.' },
    { title: 'Vencidos', description: 'Oportunidades com data prevista no passado.' },
  ],
  pessoas: [
    { title: 'Top Performers', description: 'Quem está puxando o resultado.' },
    { title: 'Quem Cresceu', description: 'Evolução positiva no período.' },
    { title: 'Quem Caiu', description: 'Quedas que precisam de atenção.' },
    { title: 'Quem Precisa de Ajuda', description: 'Sinais de necessidade de coaching.' },
  ],
  riscos: [
    { title: 'Meta em risco', description: 'Probabilidade de não bater a meta.' },
    { title: 'Pipeline insuficiente', description: 'Cobertura abaixo do necessário.' },
    { title: 'Receita concentrada', description: 'Dependência excessiva de poucos deals.' },
    { title: 'Forecast fraco', description: 'Baixa qualidade na previsão.' },
    { title: 'Cancelamentos', description: 'Risco crescente de churn comercial.' },
  ],
};

function PlaceholderGrid({ items }: { items: { title: string; description?: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <RevenuePlaceholder
          key={item.title}
          title={item.title}
          description={item.description}
        />
      ))}
    </div>
  );
}

function CopilotPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Pergunte ao Revenue Copilot</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Em breve você poderá conversar com a operação. Esta superfície será habilitada
            em uma sprint futura — nenhuma integração de IA está ativa aqui.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Em construção
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RevenueCommandPage() {
  const { enabled, loading } = useFeatureFlag('revenue_command_center_enabled');
  const [activeTab, setActiveTab] = useState('hoje');

  if (loading) {
    return (
      <PageContainer>
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </PageContainer>
    );
  }

  if (!enabled) {
    return (
      <PageContainer>
        <RevenueCommandHeader />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-3">
              <Radar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Revenue Command Center indisponível</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Este módulo está em rollout controlado. Solicite a um administrador da
              organização para habilitar o feature flag{' '}
              <code className="rounded bg-muted px-1 text-xs">
                revenue_command_center_enabled
              </code>
              .
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const tabs: RevenueCommandTab[] = [
    {
      value: 'hoje',
      label: 'Hoje na Operação',
      icon: Activity,
      content: (
        <RevenueSectionCard
          title="Hoje na Operação"
          description="Visão diária do que importa agora. Conteúdo será conectado em sprints futuras."
          icon={Activity}
        >
          <PlaceholderGrid items={PLACEHOLDER_SECTIONS.hoje} />
        </RevenueSectionCard>
      ),
    },
    {
      value: 'gargalos',
      label: 'Gargalos',
      icon: Gauge,
      content: (
        <RevenueSectionCard
          title="Gargalos"
          description="Pontos de fricção ao longo do funil."
          icon={Gauge}
        >
          <PlaceholderGrid items={PLACEHOLDER_SECTIONS.gargalos} />
        </RevenueSectionCard>
      ),
    },
    {
      value: 'pipeline',
      label: 'Pipeline Health',
      icon: HeartPulse,
      content: (
        <RevenueSectionCard
          title="Pipeline Health"
          description="Higiene e qualidade do pipeline em tempo real."
          icon={HeartPulse}
        >
          <PlaceholderGrid items={PLACEHOLDER_SECTIONS.pipeline} />
        </RevenueSectionCard>
      ),
    },
    {
      value: 'pessoas',
      label: 'Pessoas',
      icon: Users,
      content: (
        <RevenueSectionCard
          title="Pessoas"
          description="Desempenho individual e de times."
          icon={Users}
        >
          <PlaceholderGrid items={PLACEHOLDER_SECTIONS.pessoas} />
        </RevenueSectionCard>
      ),
    },
    {
      value: 'riscos',
      label: 'Riscos',
      icon: AlertTriangle,
      content: (
        <RevenueSectionCard
          title="Riscos"
          description="Sinais que ameaçam a meta comercial."
          icon={AlertTriangle}
        >
          <PlaceholderGrid items={PLACEHOLDER_SECTIONS.riscos} />
        </RevenueSectionCard>
      ),
    },
    {
      value: 'ia',
      label: 'IA',
      icon: Bot,
      content: <CopilotPlaceholder />,
    },
  ];

  return (
    <PageContainer>
      <RevenueCommandHeader />
      <RevenueCommandTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
    </PageContainer>
  );
}
