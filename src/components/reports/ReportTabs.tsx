import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Target,
  Activity,
  Users,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportTabsProps {
  activeReport: string;
  onSelectReport: (reportId: string) => void;
}

const reportTabs = [
  { id: 'general', label: 'Geral', icon: BarChart3, category: 'overview' },
  { id: 'processed', label: 'Processadas', icon: Activity, category: 'opportunities' },
  { id: 'lost-reasons', label: 'Perdidas', icon: TrendingDown, category: 'opportunities' },
  { id: 'accumulated', label: 'Acumuladas', icon: TrendingUp, category: 'opportunities' },
  { id: 'funnel-balance', label: 'Balanceamento', icon: Target, category: 'funnel' },
  { id: 'conversion-rate', label: 'Conversão', icon: Zap, category: 'funnel' },
  { id: 'forecast', label: 'Forecast', icon: Calendar, category: 'performance' },
  { id: 'team-performance', label: 'Performance', icon: Users, category: 'performance' },
];

const categoryLabels = {
  overview: 'Visão Geral',
  opportunities: 'Oportunidades',
  funnel: 'Funil',
  performance: 'Desempenho',
};

export function ReportTabs({ activeReport, onSelectReport }: ReportTabsProps) {
  const categories = ['overview', 'opportunities', 'funnel', 'performance'] as const;

  return (
    <div className="border-b bg-card">
      <Tabs value={activeReport} onValueChange={onSelectReport} className="w-full">
        <TabsList className="w-full h-auto bg-transparent p-0 flex-wrap md:flex-nowrap justify-start overflow-x-auto">
          {categories.map((category, categoryIdx) => {
            const categoryTabs = reportTabs.filter(tab => tab.category === category);
            
            return (
              <div key={category} className="flex items-center">
                {categoryIdx > 0 && (
                  <div className="hidden md:block h-8 w-px bg-border mx-1" />
                )}
                
                <div className="flex flex-col py-2 px-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 px-2">
                    {categoryLabels[category]}
                  </span>
                  
                  <div className="flex gap-1">
                    {categoryTabs.map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeReport === tab.id;
                      
                      return (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className={cn(
                            "relative px-3 py-2 text-sm font-medium rounded-md transition-all",
                            "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground",
                            "data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground",
                            "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                            "data-[state=active]:shadow-none",
                            "flex items-center gap-2 whitespace-nowrap"
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="hidden sm:inline">{tab.label}</span>
                          
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
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
