import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search as SearchIcon } from 'lucide-react';
import { LeadSearchForm } from './LeadSearchForm';
import { LeadResultsTable } from './LeadResultsTable';
import { RecentRunsList } from './RecentRunsList';
import { usePlaybookRuns, useProspects, useCreatePlaybookRun, useUpdateProspectStatus } from '@/hooks/useLeadSourcingV2';

export function LeadSourcingEngine() {
  const [showForm, setShowForm] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs = [], isLoading: runsLoading } = usePlaybookRuns();
  const { data: prospects = [] } = useProspects(selectedRunId);
  const createRunMutation = useCreatePlaybookRun();
  const updateStatusMutation = useUpdateProspectStatus();

  const handleExecute = async (params: {
    playbookType: string;
    icpProfileId: string | null;
    inputPayload: Record<string, any>;
    importRules: {
      approvalMode: string;
      scoreThreshold: number;
      autoImport: boolean;
      autoCreateOpportunity: boolean;
      autoAssignOwner: boolean;
    };
  }) => {
    const data = await createRunMutation.mutateAsync(params);
    if (data?.run_id) {
      setSelectedRunId(data.run_id);
      setShowForm(false);
      // Show stats toast if available
      const stats = data.stats;
      if (stats) {
        const parts = [`${stats.prospects_created || data.prospects_count || 0} prospects criados`];
        if (stats.duplicates_in_input > 0) parts.push(`${stats.duplicates_in_input} duplicados ignorados`);
        if (stats.invalid_items > 0) parts.push(`${stats.invalid_items} inválidos`);
        toast.success(parts.join(', '));
      }
    }
  };

  const handleApprove = (id: string) => updateStatusMutation.mutate({ prospectId: id, status: 'approved' });
  const handleReject = (id: string) => updateStatusMutation.mutate({ prospectId: id, status: 'rejected' });
  const handleCreateOpportunity = (id: string) => {
    updateStatusMutation.mutate({ prospectId: id, status: 'converted' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Lead Sourcing Engine</h2>
          <p className="text-sm text-muted-foreground">
            Descubra novas oportunidades automaticamente com base no seu ICP
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Busca de Leads
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <LeadSearchForm onExecute={handleExecute} isExecuting={createRunMutation.isPending} />
      )}

      {/* Recent Runs */}
      {!showForm && runs.length > 0 && (
        <RecentRunsList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
      )}

      {/* Results */}
      {selectedRunId && prospects.length > 0 && (
        <LeadResultsTable
          prospects={prospects}
          onApprove={handleApprove}
          onReject={handleReject}
          onCreateOpportunity={handleCreateOpportunity}
          isUpdating={updateStatusMutation.isPending}
        />
      )}

      {/* Empty State */}
      {!showForm && runs.length === 0 && !runsLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <SearchIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <div className="text-lg font-medium mb-1">Nenhuma busca realizada</div>
            <div className="text-sm text-muted-foreground mb-4">
              Comece descobrindo novos leads com base no seu ICP
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Busca de Leads
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
