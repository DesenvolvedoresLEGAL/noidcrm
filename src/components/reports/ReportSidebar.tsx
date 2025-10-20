import { cn } from '@/lib/utils';
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReportSidebarProps {
  activeReport: string;
  onSelectReport: (reportId: string) => void;
}

const reportCategories = [
  {
    title: 'Visão Geral',
    reports: [
      { id: 'general', label: 'Geral', icon: BarChart3 },
    ]
  },
  {
    title: 'Oportunidades',
    reports: [
      { id: 'processed', label: 'Oportunidades processadas', icon: Activity },
      { id: 'lost-reasons', label: 'Oportunidades perdidas por motivo', icon: TrendingDown },
      { id: 'accumulated', label: 'Oportunidades acumuladas por dia', icon: TrendingUp },
    ]
  },
  {
    title: 'Análise de Funil',
    reports: [
      { id: 'funnel-balance', label: 'Balanceamento do funil', icon: Target },
      { id: 'conversion-rate', label: 'Taxa de conversão', icon: Zap },
    ]
  },
  {
    title: 'Desempenho',
    reports: [
      { id: 'forecast', label: 'Forecast', icon: Calendar },
      { id: 'team-performance', label: 'Performance do time', icon: Users },
    ]
  }
];

export function ReportSidebar({ activeReport, onSelectReport }: ReportSidebarProps) {
  return (
    <div className="w-64 border-r bg-card h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Relatórios</h2>
        <p className="text-sm text-muted-foreground">Análises e métricas</p>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2">
          {reportCategories.map((category, idx) => (
            <div key={idx} className="mb-4">
              <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category.title}
                </h3>
              </div>
              
              <div className="space-y-1">
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  const isActive = activeReport === report.id;
                  
                  return (
                    <button
                      key={report.id}
                      onClick={() => onSelectReport(report.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive 
                          ? "bg-primary text-primary-foreground font-medium" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{report.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
