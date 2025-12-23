import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Activity,
  Settings,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import {
  useWorkflowRules,
  useToggleWorkflowRule,
  useDeleteWorkflowRule,
  useDuplicateWorkflowRule,
  useWorkflowExecutions,
} from '@/hooks/useWorkflowRules';
import { WorkflowRule } from '@/services/crm/workflow-rules';
import { WorkflowRuleModal } from './WorkflowRuleModal';
import { AutomationImpactKPIs } from './AutomationImpactKPIs';
import { AutomationCategoryBreakdown } from './AutomationCategoryBreakdown';
import { AutomationRulesList } from './AutomationRulesList';
import { AutomationExecutionHistory } from './AutomationExecutionHistory';
import { AutomationGuide } from './AutomationGuide';
import { ConversationalAutomationInput } from './ConversationalAutomationInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AutomationLog {
  id: string;
  opportunity_id: string;
  action_type: string;
  channel: string;
  message_content?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  metadata?: any;
}

export function UnifiedAutomationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const { data: rules = [], isLoading, refetch: refetchRules } = useWorkflowRules();
  const { data: executions = [] } = useWorkflowExecutions({ limit: 100 });
  const toggleMutation = useToggleWorkflowRule();
  const deleteMutation = useDeleteWorkflowRule();
  const duplicateMutation = useDuplicateWorkflowRule();
  
  const handleRulesChange = () => {
    refetchRules();
  };

  useEffect(() => {
    fetchAutomationLogs();
  }, []);

  const fetchAutomationLogs = async () => {
    try {
      setLogsLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData, error } = await supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(logsData || []);
    } catch (error) {
      console.error('Error fetching automation logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleEdit = (rule: WorkflowRule) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversational AI Input */}
      <ConversationalAutomationInput 
        existingRules={rules}
        onRuleCreated={handleRulesChange}
        onRuleUpdated={handleRulesChange}
        onRuleDeleted={handleRulesChange}
      />

      {/* Guia de Automação */}
      <AutomationGuide />

      {/* Impact KPIs */}
      <AutomationImpactKPIs executions={executions} rules={rules} />

      {/* Category Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Por Categoria</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Ferramentas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <Download className="h-4 w-4 mr-2" />
                Exportar Regras
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Upload className="h-4 w-4 mr-2" />
                Importar Regras
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AutomationCategoryBreakdown 
          rules={rules} 
          selectedCategory={selectedCategory}
          onCategoryClick={setSelectedCategory}
        />
      </div>

      {/* Tabs: Rules and History */}
      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Activity className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <AutomationRulesList
            rules={rules}
            selectedCategory={selectedCategory}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onDuplicate={(id) => duplicateMutation.mutate(id)}
            onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <AutomationExecutionHistory
            executions={executions}
            logs={logs}
            isLoading={logsLoading}
            onRefresh={fetchAutomationLogs}
          />
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <WorkflowRuleModal open={isModalOpen} onOpenChange={setIsModalOpen} rule={selectedRule} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={confirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
