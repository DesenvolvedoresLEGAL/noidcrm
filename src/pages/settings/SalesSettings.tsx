import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  GitBranch, 
  Percent, 
  Users, 
  Layers, 
  Calculator, 
  Zap,
  UserCog,
  ArrowLeft,
  Settings,
  Flag,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { GoalSystemModeSelector } from '@/components/ote/GoalSystemModeSelector';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

// Import existing config components
import { OTELevelsConfig } from '@/components/ote/config/OTELevelsConfig';
import { OTEMultipliersConfig } from '@/components/ote/config/OTEMultipliersConfig';
import { OTESellerAssignment } from '@/components/ote/config/OTESellerAssignment';
import { OTERulesConfig } from '@/components/ote/config/OTERulesConfig';
import { MetasSection } from '@/components/ote/config/sections/MetasSection';
import { FunilSection } from '@/components/ote/config/sections/FunilSection';
import { TaxasSection } from '@/components/ote/config/sections/TaxasSection';
import { HeadcountSection } from '@/components/ote/config/sections/HeadcountSection';
import { OTEFlagsConfig } from '@/components/ote/config/OTEFlagsConfig';
import { FitScoreConfigManager } from '@/components/team/evaluations';

interface ConfigCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  category: 'planejamento' | 'sistema';
}

const CONFIG_CARDS: ConfigCard[] = [
  // PLANEJAMENTO
  {
    id: 'metas',
    title: 'Metas',
    description: 'Metas de receita por período (mensal, trimestral, semestral, anual)',
    icon: Target,
    colorClass: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 hover:border-blue-500/50',
    category: 'planejamento',
  },
  {
    id: 'funil',
    title: 'Funil Reverso',
    description: 'Calcule quantas atividades são necessárias para atingir suas metas',
    icon: GitBranch,
    colorClass: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-500/50',
    category: 'planejamento',
  },
  {
    id: 'taxas',
    title: 'Taxas de Conversão',
    description: 'Taxas de conversão por canal (Outbound, Inbound, Indicação)',
    icon: Percent,
    colorClass: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 hover:border-amber-500/50',
    category: 'planejamento',
  },
  {
    id: 'headcount',
    title: 'Headcount',
    description: 'Quantidade de pessoas por função (SDR, Closer, Farmer, CS)',
    icon: Users,
    colorClass: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 hover:border-purple-500/50',
    category: 'planejamento',
  },
  // SISTEMA OTE
  {
    id: 'niveis',
    title: 'Níveis OTE',
    description: 'Configure os níveis de comissão e suas faixas de salário',
    icon: Layers,
    colorClass: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 hover:border-cyan-500/50',
    category: 'sistema',
  },
  {
    id: 'multiplicadores',
    title: 'Multiplicadores',
    description: 'Defina multiplicadores por faixa de atingimento de meta',
    icon: Calculator,
    colorClass: 'from-rose-500/20 to-rose-600/5 border-rose-500/30 hover:border-rose-500/50',
    category: 'sistema',
  },
  {
    id: 'regras',
    title: 'Regras',
    description: 'Aceleradores, desaceleradores e regras de performance',
    icon: Zap,
    colorClass: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 hover:border-orange-500/50',
    category: 'sistema',
  },
  {
    id: 'flags',
    title: 'Flags',
    description: 'Configure thresholds de Blue, Yellow e Red Flag',
    icon: Flag,
    colorClass: 'from-sky-500/20 to-sky-600/5 border-sky-500/30 hover:border-sky-500/50',
    category: 'sistema',
  },
  {
    id: 'vendedores',
    title: 'Vendedores',
    description: 'Atribua níveis OTE e configure metas individuais',
    icon: UserCog,
    colorClass: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 hover:border-indigo-500/50',
    category: 'sistema',
  },
  {
    id: 'fitscore',
    title: 'FitScore',
    description: 'Configure pesos e fatores de avaliação de vendedores',
    icon: Star,
    colorClass: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 hover:border-yellow-500/50',
    category: 'sistema',
  },
];

const DRAWER_TITLES: Record<string, { title: string; description: string }> = {
  metas: { title: 'Metas por Período', description: 'Configure metas de receita para cada período' },
  funil: { title: 'Funil Reverso', description: 'Calcule atividades necessárias para atingir metas' },
  taxas: { title: 'Taxas de Conversão', description: 'Configure taxas por canal de aquisição' },
  headcount: { title: 'Headcount', description: 'Defina a quantidade de pessoas por função' },
  niveis: { title: 'Níveis OTE', description: 'Configure níveis de comissão' },
  multiplicadores: { title: 'Multiplicadores', description: 'Defina multiplicadores por atingimento' },
  regras: { title: 'Regras', description: 'Configure aceleradores e desaceleradores' },
  flags: { title: 'Flags de Performance', description: 'Configure thresholds de Blue, Yellow e Red Flag' },
  vendedores: { title: 'Vendedores', description: 'Atribua níveis e metas individuais' },
  fitscore: { title: 'FitScore', description: 'Configure pesos e fatores de avaliação de vendedores' },
};

export default function SalesSettings() {
  const navigate = useNavigate();
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);
  const { isAdmin } = useCurrentOrganization();

  const planejamentoCards = CONFIG_CARDS.filter(c => c.category === 'planejamento');
  const sistemaCards = CONFIG_CARDS.filter(c => c.category === 'sistema');

  const renderDrawerContent = () => {
    switch (openDrawer) {
      case 'metas':
        return <MetasSection />;
      case 'funil':
        return <FunilSection />;
      case 'taxas':
        return <TaxasSection />;
      case 'headcount':
        return <HeadcountSection />;
      case 'niveis':
        return <OTELevelsConfig />;
      case 'multiplicadores':
        return <OTEMultipliersConfig />;
      case 'regras':
        return <OTERulesConfig />;
      case 'flags':
        return <OTEFlagsConfig />;
      case 'vendedores':
        return <OTESellerAssignment />;
      case 'fitscore':
        return <FitScoreConfigManager />;
      default:
        return null;
    }
  };

  const drawerInfo = openDrawer ? DRAWER_TITLES[openDrawer] : null;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:px-6 md:pt-6 md:pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/app/reports/ote')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
                  <Settings className="h-7 w-7 text-primary" />
                  Configurações de Vendas
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  Configure metas, funil, taxas e o sistema OTE
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:px-6 md:py-6">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Mode Selector - Admin only */}
            {isAdmin && (
              <div className="mb-8">
                <GoalSystemModeSelector />
              </div>
            )}

            {/* PLANEJAMENTO Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider px-3 py-1">
                  Planejamento
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {planejamentoCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card 
                      key={card.id}
                      className={`cursor-pointer transition-all duration-300 bg-gradient-to-br ${card.colorClass} hover:shadow-lg hover:-translate-y-1 group`}
                      onClick={() => setOpenDrawer(card.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-background/80 shadow-sm group-hover:scale-110 transition-transform">
                            <Icon className="h-5 w-5 text-foreground" />
                          </div>
                          <CardTitle className="text-base font-semibold">{card.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-sm leading-relaxed">
                          {card.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* SISTEMA OTE Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider px-3 py-1">
                  Sistema OTE
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {sistemaCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card 
                      key={card.id}
                      className={`cursor-pointer transition-all duration-300 bg-gradient-to-br ${card.colorClass} hover:shadow-lg hover:-translate-y-1 group`}
                      onClick={() => setOpenDrawer(card.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-background/80 shadow-sm group-hover:scale-110 transition-transform">
                            <Icon className="h-5 w-5 text-foreground" />
                          </div>
                          <CardTitle className="text-base font-semibold">{card.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-sm leading-relaxed">
                          {card.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Drawer for configuration content */}
      <Sheet open={!!openDrawer} onOpenChange={(open) => !open && setOpenDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">{drawerInfo?.title}</SheetTitle>
            <SheetDescription>{drawerInfo?.description}</SheetDescription>
          </SheetHeader>
          {renderDrawerContent()}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
