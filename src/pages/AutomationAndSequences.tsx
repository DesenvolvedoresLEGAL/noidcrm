import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Layers } from 'lucide-react';
import { UnifiedAutomationTab } from '@/components/workflows/UnifiedAutomationTab';
import Sequences from './Sequences';

export default function AutomationAndSequences() {
  const [activeTab, setActiveTab] = useState<'automation' | 'sequences'>('automation');

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header Unificado */}
        <div className="flex flex-col gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Automação</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie automações e cadências de comunicação
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'automation' | 'sequences')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="sequences" className="gap-2">
              <Layers className="h-4 w-4" />
              Cadências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="automation" className="mt-6">
            <UnifiedAutomationTab />
          </TabsContent>

          <TabsContent value="sequences" className="mt-6">
            <Sequences embedded />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
