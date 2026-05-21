import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Target,
  Activity,
  Users,
  Zap,
  UserCheck,
  Award,
  Layers,
  Handshake,
  Brain,
  Compass,
  UserSearch,
  Package,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportTabsProps {
  activeReport: string;
  onSelectReport: (reportId: string) => void;
}

const reportTabs = [
  { id: 'vendas-realizadas', label: 'Vendas Realizadas', icon: ShieldCheck, category: 'overview' },
  { id: 'general', label: 'Geral', icon: BarChart3, category: 'overview' },
  { id: 'ai-insights', label: 'Insights IA', icon: Brain, category: 'overview' },
  { id: 'processed', label: 'Processadas', icon: Activity, category: 'opportunities' },
  { id: 'lost-reasons', label: 'Perdidas', icon: TrendingDown, category: 'opportunities' },
  { id: 'accumulated', label: 'Acumuladas', icon: TrendingUp, category: 'opportunities' },
  { id: 'origins', label: 'Origens', icon: Compass, category: 'opportunities' },
  { id: 'funnel-balance', label: 'Balanceamento', icon: Target, category: 'funnel' },
  { id: 'conversion-rate', label: 'Conversão', icon: Zap, category: 'funnel' },
  { id: 'stage-conversion', label: 'Estágios', icon: Layers, category: 'funnel' },
  { id: 'forecast', label: 'Forecast', icon: Calendar, category: 'performance' },
  { id: 'team-performance', label: 'Performance', icon: Users, category: 'performance' },
  { id: 'sdr-performance', label: 'SDR', icon: UserCheck, category: 'performance' },
  { id: 'closer-performance', label: 'Closer', icon: Award, category: 'performance' },
  { id: 'handoff', label: 'Handoff', icon: Handshake, category: 'performance' },
  { id: 'enriched-decision-makers', label: 'Decisores Enriquecidos', icon: UserSearch, category: 'intelligence' },
  { id: 'products', label: 'Produtos', icon: Package, category: 'catalog' },
];

const categoryLabels = {
  overview: 'Visão Geral',
  opportunities: 'Oportunidades',
  funnel: 'Funil',
  performance: 'Desempenho',
  intelligence: 'Inteligência',
  catalog: 'Catálogo',
};

export function ReportTabs({ activeReport, onSelectReport }: ReportTabsProps) {
  const categories = ['overview', 'opportunities', 'funnel', 'performance', 'intelligence', 'catalog'] as const;

  return (
    <div className="border-b bg-card shadow-sm">
      <Tabs value={activeReport} onValueChange={onSelectReport} className="w-full">
        <TabsList className="w-full h-auto bg-transparent p-0 flex-wrap md:flex-nowrap justify-start overflow-x-auto">
          {categories.map((category, categoryIdx) => {
            const categoryTabs = reportTabs.filter(tab => tab.category === category);
            
            return (
              <div key={category} className="flex items-center">
                {categoryIdx > 0 && (
                  <div className="hidden md:block h-10 w-[2px] bg-border/60 mx-2" />
                )}
                
                <div className="flex flex-col py-3 px-3">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/80 mb-2 px-2">
                    {categoryLabels[category]}
                  </span>
                  
                  <div className="flex gap-1.5">
                    {categoryTabs.map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeReport === tab.id;
                      
                      return (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className={cn(
                            "relative px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200",
                            "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground",
                            "data-[state=inactive]:hover:bg-muted/60 data-[state=inactive]:hover:text-foreground",
                            "data-[state=active]:bg-primary/15 data-[state=active]:text-primary",
                            "data-[state=active]:shadow-sm",
                            "flex items-center gap-2 whitespace-nowrap"
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="hidden sm:inline">{tab.label}</span>
                          
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full" />
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
