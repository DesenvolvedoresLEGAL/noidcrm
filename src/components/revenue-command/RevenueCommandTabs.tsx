import { LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export interface RevenueCommandTab {
  value: string;
  label: string;
  icon?: LucideIcon;
  content: React.ReactNode;
}

interface RevenueCommandTabsProps {
  tabs: RevenueCommandTab[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Sprint REVOPS V3.0 — Wrapper de tabs do Revenue Command Center.
 * Apenas estrutura visual; nenhuma lógica de negócio.
 */
export function RevenueCommandTabs({ tabs, value, onValueChange }: RevenueCommandTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 data-[state=active]:bg-background"
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
