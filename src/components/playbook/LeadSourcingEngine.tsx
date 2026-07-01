import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Search as SearchIcon, History, Radar } from 'lucide-react';
import { ModuleHeader, PremiumEmpty } from '@/components/intelligence/kairos/premium';
import { LeadSearchForm } from './LeadSearchForm';
import { LeadResultsTable } from './LeadResultsTable';
import { RecentRunsList } from './RecentRunsList';
import { ProspectDetailDrawer } from './ProspectDetailDrawer';
import { EventProgressStepper } from './EventProgressStepper';
import { RunHistoryTable } from './RunHistoryTable';
import { RunDetailDrawer } from './RunDetailDrawer';
import { usePlaybookRuns, useProspects, useCreatePlaybookRun, useUpdateProspectStatus, useBulkUpdateProspects } from '@/hooks/useLeadSourcingV2';
import { useImportProspect, useBulkImportProspects } from '@/hooks/useProspectImport';
import type { Prospect, PlaybookRun } from '@/hooks/useLeadSourcingV2';

export function LeadSourcingEngine() {
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [drawerProspect, setDrawerProspect] = useState<Prospect | null>(null);
  const [detailRun, setDetailRun] = useState<PlaybookRun | null>(null);
  const [isEventRunning, setIsEventRunning] = useState(false);
  const [eventElapsed, setEventElapsed] = useState(0);

  const { data: runs = [], isLoading: runsLoading } = usePlaybookRuns();
  const { data: prospects = [] } = useProspects(selectedRunId);
  const createRunMutation = useCreatePlaybookRun();
  const updateStatusMutation = useUpdateProspectStatus();
  const bulkUpdateMutation = useBulkUpdateProspects();
  const importMutation = useImportProspect();
  const bulkImportMutation = useBulkImportProspects();

  useEffect(() => {
    if (!isEventRunning || !selectedRunId) return;

    const selectedRun = runs.find(run => run.id === selectedRunId);
    if (selectedRun && selectedRun.status !== 'running') {
      setIsEventRunning(false);
      if (selectedRun.status === 'completed_empty') {
        const stats = selectedRun.stats as any;
        toast.warning(`${stats?.exhibitors_extracted_raw || 0} expositores extraídos, mas 0 passaram no threshold de score (${stats?.score_threshold_used || '?'}). Tente reduzir o threshold.`);
      }
    }
  }, [isEventRunning, selectedRunId, runs]);

  useEffect(() => {
    if (!drawerProspect) return;
    const refreshedProspect = prospects.find((prospect) => prospect.id === drawerProspect.id);
    if (refreshedProspect && refreshedProspect !== drawerProspect) {
      setDrawerProspect(refreshedProspect);
    }
  }, [drawerProspect, prospects]);

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
    const isEvent = params.playbookType === 'event';
    if (isEvent) {
      setIsEventRunning(true);
      setEventElapsed(0);
      const timer = setInterval(() => setEventElapsed(prev => prev + 1), 1000);
      try {
        const data = await createRunMutation.mutateAsync(params);
        clearInterval(timer);
        if (data?.run_id) {
          setSelectedRunId(data.run_id);
          setShowForm(false);
          if (data?.async || data?.status === 'running') {
            toast.success('Execução iniciada em background. Acompanhe pelo histórico.');
          } else {
            setIsEventRunning(false);
            const stats = data.stats;
            if (stats) {
              toast.success(`${stats.prospects_created || stats.persisted_prospects || 0} expositores encontrados`);
            }
          }
        } else {
          setIsEventRunning(false);
        }
      } catch {
        clearInterval(timer);
        setIsEventRunning(false);
      }
      return;
    }

    const data = await createRunMutation.mutateAsync(params);
    if (data?.run_id) {
      setSelectedRunId(data.run_id);
      setShowForm(false);
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

  const handleImport = (prospect: Prospect) => {
    importMutation.mutate(prospect);
  };

  const handleBulkImport = (selectedProspects: Prospect[]) => {
    bulkImportMutation.mutate(selectedProspects);
  };

  const handleBulkApprove = (ids: string[]) => bulkUpdateMutation.mutate({ prospectIds: ids, status: 'approved' });
  const handleBulkReject = (ids: string[]) => bulkUpdateMutation.mutate({ prospectIds: ids, status: 'rejected' });

  const handleViewProspects = (runId: string) => {
    setSelectedRunId(runId);
    setShowHistory(false);
  };

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Radar}
        eyebrow="Kairós · Inteligência"
        title="Lead Sourcing Engine"
        description="Descubra novas oportunidades automaticamente com base no seu ICP."
        accent="violet"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { setShowHistory(!showHistory); setShowForm(false); }}>
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
            <Button size="sm" onClick={() => { setShowForm(!showForm); setShowHistory(false); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Busca
            </Button>
          </>
        }
      />

      {/* Event Progress Stepper */}
      {isEventRunning && (
        <EventProgressStepper elapsedSeconds={eventElapsed} />
      )}

      {/* Form */}
      {showForm && !isEventRunning && (
        <LeadSearchForm onExecute={handleExecute} isExecuting={createRunMutation.isPending} />
      )}

      {/* History */}
      {showHistory && !showForm && (
        <RunHistoryTable
          onSelectRun={setDetailRun}
          onViewProspects={handleViewProspects}
        />
      )}

      {/* Recent Runs */}
      {!showForm && !showHistory && runs.length > 0 && (
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
          onImport={handleImport}
          onBulkImport={handleBulkImport}
          onBulkApprove={handleBulkApprove}
          onBulkReject={handleBulkReject}
          onOpenDetail={setDrawerProspect}
          isUpdating={updateStatusMutation.isPending || bulkUpdateMutation.isPending}
          isImporting={importMutation.isPending || bulkImportMutation.isPending}
        />
      )}

      {/* Empty State */}
      {!showForm && !showHistory && runs.length === 0 && !runsLoading && (
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

      {/* Detail Drawer */}
      <ProspectDetailDrawer
        prospect={drawerProspect}
        open={!!drawerProspect}
        onClose={() => setDrawerProspect(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onCreateOpportunity={handleCreateOpportunity}
        onImport={handleImport}
        isUpdating={updateStatusMutation.isPending}
        isImporting={importMutation.isPending}
      />

      {/* Run Detail Drawer */}
      <RunDetailDrawer
        run={detailRun}
        open={!!detailRun}
        onClose={() => setDetailRun(null)}
        onViewProspects={handleViewProspects}
      />
    </div>
  );
}
