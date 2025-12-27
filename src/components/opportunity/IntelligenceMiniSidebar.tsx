import { Network, Brain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type IntelligencePanel = 'graph' | 'memories';

interface IntelligenceMiniSidebarProps {
  activePanel: IntelligencePanel | null;
  onSelectPanel: (panel: IntelligencePanel | null) => void;
}

const panels: { id: IntelligencePanel; icon: typeof Network; label: string; colorClass: string }[] = [
  { id: 'graph', icon: Network, label: 'Rede', colorClass: 'text-blue-500' },
  { id: 'memories', icon: Brain, label: 'Memórias', colorClass: 'text-purple-500' },
];

export function IntelligenceMiniSidebar({ activePanel, onSelectPanel }: IntelligenceMiniSidebarProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "absolute top-0 right-0 h-full flex flex-col items-center",
          "w-12 group hover:w-36",
          "bg-background/80 backdrop-blur-sm border-l border-border/50",
          "transition-all duration-200 ease-out",
          "z-20 shadow-sm hover:shadow-lg"
        )}
      >
        <div className="flex-1 flex flex-col gap-1 py-4 px-1.5 w-full">
          {panels.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;

            return (
              <Tooltip key={panel.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectPanel(isActive ? null : panel.id)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg w-full",
                      "transition-all duration-150",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-primary-foreground" : panel.colorClass
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap",
                        "opacity-0 group-hover:opacity-100",
                        "transition-opacity duration-200",
                        isActive && "text-primary-foreground"
                      )}
                    >
                      {panel.label}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="group-hover:hidden">
                  {panel.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
