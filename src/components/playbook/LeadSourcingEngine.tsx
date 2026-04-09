import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search as SearchIcon } from 'lucide-react';
import { LeadSearchForm } from './LeadSearchForm';
import { LeadResultsTable } from './LeadResultsTable';
import { useLeadSearches, useLeadSearchResults, useExecuteLeadSearch, useUpdateLeadResultStatus } from '@/hooks/useLeadSourcing';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function LeadSourcingEngine() {
  const [showForm, setShowForm] = useState(false);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);

  const { data: searches, isLoading: searchesLoading } = useLeadSearches();
  const { data: results = [] } = useLeadSearchResults(selectedSearchId);
  const executeMutation = useExecuteLeadSearch();
  const updateStatusMutation = useUpdateLeadResultStatus();

  const handleExecute = async (params: { search_type: string; icp_id: string | null; config: Record<string, any> }) => {
    const data = await executeMutation.mutateAsync(params);
    if (data?.search_id) {
      setSelectedSearchId(data.search_id);
      setShowForm(false);
    }
  };

  const handleApprove = (id: string) => updateStatusMutation.mutate({ resultId: id, status: 'approved' });
  const handleReject = (id: string) => updateStatusMutation.mutate({ resultId: id, status: 'rejected' });
  const handleCreateOpportunity = (id: string) => {
    // TODO: create opportunity from lead result
    updateStatusMutation.mutate({ resultId: id, status: 'converted' });
  };

  const searchTypeLabels: Record<string, string> = {
    event: 'Evento', directory: 'Diretório', geo: 'Geográfica', seed: 'Seed', import: 'Importação',
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
        <LeadSearchForm onExecute={handleExecute} isExecuting={executeMutation.isPending} />
      )}

      {/* Previous Searches */}
      {!showForm && searches && searches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Buscas Anteriores</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {searches.map(search => (
              <Card
                key={search.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  selectedSearchId === search.id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedSearchId(search.id)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="mb-1.5">
                        {searchTypeLabels[search.search_type] || search.search_type}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(search.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-medium">{search.results_count} leads</div>
                      <div className="text-green-600">{search.approved_count} aprovados</div>
                    </div>
                  </div>
                  <Badge
                    variant={search.status === 'completed' ? 'default' : search.status === 'running' ? 'secondary' : 'outline'}
                    className="mt-2 text-xs"
                  >
                    {search.status === 'completed' ? 'Concluída' : search.status === 'running' ? 'Executando...' : search.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {selectedSearchId && (
        <LeadResultsTable
          results={results}
          onApprove={handleApprove}
          onReject={handleReject}
          onCreateOpportunity={handleCreateOpportunity}
          isUpdating={updateStatusMutation.isPending}
        />
      )}

      {/* Empty State */}
      {!showForm && (!searches || searches.length === 0) && !searchesLoading && (
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
