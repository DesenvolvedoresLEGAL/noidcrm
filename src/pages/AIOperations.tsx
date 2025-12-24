import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Bot, Clock, Bell, Activity, UserPlus, Workflow } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AIStatsOverview } from '@/components/ai-operations/AIStatsOverview';
import { PendingApprovalsCard } from '@/components/ai-operations/PendingApprovalsCard';
import { AIAlertsCard } from '@/components/ai-operations/AIAlertsCard';
import { AIActionsHistoryCard } from '@/components/ai-operations/AIActionsHistoryCard';
import { LeadIngestionPanel } from '@/components/ai-operations/LeadIngestionPanel';
import { AIOperationsDashboard } from '@/components/ai-operations/AIOperationsDashboard';

export default function AIOperations() {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-action-stats'] });
    queryClient.invalidateQueries({ queryKey: ['ai-alert-stats'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['recent-ai-actions'] });
    queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-automations'] });
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              Central de Operações IA
            </h1>
            <p className="text-muted-foreground">
              Supervisione, aprove e corrija as decisões autônomas da IA
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Overview */}
        <AIStatsOverview />

        {/* Tabs */}
        <Tabs defaultValue="supervision" className="space-y-4">
          <TabsList>
            <TabsTrigger value="supervision" className="gap-2">
              <Clock className="h-4 w-4" />
              Supervisão
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Activity className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2">
              <Workflow className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="lead-ingestion" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Lead Ingestion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="supervision" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PendingApprovalsCard />
              <AIAlertsCard />
            </div>
          </TabsContent>

          <TabsContent value="alerts">
            <AIAlertsCard />
          </TabsContent>

          <TabsContent value="history">
            <AIActionsHistoryCard />
          </TabsContent>

          <TabsContent value="automations">
            <AIOperationsDashboard />
          </TabsContent>

          <TabsContent value="lead-ingestion">
            <LeadIngestionPanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
