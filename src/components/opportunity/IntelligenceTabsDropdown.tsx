import { useState } from 'react';
import { ChevronDown, Brain, Network, BarChart3, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type IntelligenceTab = 'graph' | 'memories' | 'analytics' | 'forms';

interface IntelligenceTabsDropdownProps {
  activeTab?: IntelligenceTab;
  onSelectTab: (tab: IntelligenceTab) => void;
  showAnalytics?: boolean;
}

const INTELLIGENCE_TABS: { value: IntelligenceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'graph', label: 'Rede', icon: Network },
  { value: 'memories', label: 'Memórias', icon: Brain },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'forms', label: 'Formulários', icon: ClipboardList },
];

export function IntelligenceTabsDropdown({ activeTab, onSelectTab, showAnalytics = true }: IntelligenceTabsDropdownProps) {
  const [open, setOpen] = useState(false);
  
  const tabs = INTELLIGENCE_TABS.filter(tab => {
    if (tab.value === 'analytics' && !showAnalytics) return false;
    return true;
  });

  const activeTabInfo = tabs.find(t => t.value === activeTab);
  const isActive = !!activeTab;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1 text-xs px-2 py-1.5 h-auto",
            isActive && "bg-muted text-foreground"
          )}
        >
          <Brain className="h-3 w-3 hidden sm:inline" />
          {activeTabInfo ? activeTabInfo.label : 'Inteligência'}
          <ChevronDown className="h-3 w-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px] bg-popover">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <DropdownMenuItem
              key={tab.value}
              onClick={() => {
                onSelectTab(tab.value);
                setOpen(false);
              }}
              className={cn(
                "gap-2 cursor-pointer",
                activeTab === tab.value && "bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
