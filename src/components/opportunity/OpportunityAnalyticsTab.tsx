import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, AlertTriangle, Brain } from 'lucide-react';
import { ProposalAnalyticsPanel } from '@/components/proposals/ProposalAnalyticsPanel';
import { AIProposalInsightCard } from '@/components/proposals/AIProposalInsightCard';
import { RecommendedActionsGrid } from '@/components/proposals/RecommendedActionsGrid';
// Sprint C.2: Ações Recomendadas movidas para a coluna central, abaixo do
// Mapa de Atenção, em formato de grid de cards. AI Insights na lateral
// direita mantém apenas resumo, engajamento, probabilidade e insights.
import { supabase } from '@/integrations/supabase/client';

interface OpportunityAnalyticsTabProps {
  opportunityId: string;
}

export function OpportunityAnalyticsTab({ opportunityId }: OpportunityAnalyticsTabProps) {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Fetch proposals for this opportunity
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['opportunity-proposals-analytics', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, title, status, created_at, proposal_number, total_amount')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!opportunityId,
  });

  // Auto-select first proposal when loaded
  const activeProposalId = selectedProposalId || proposals[0]?.id || null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'outline', label: 'Rascunho' },
      sent: { variant: 'secondary', label: 'Enviada' },
      viewed: { variant: 'default', label: 'Visualizada' },
      accepted: { variant: 'default', label: 'Aceita' },
      rejected: { variant: 'destructive', label: 'Rejeitada' },
      expired: { variant: 'outline', label: 'Expirada' },
    };
    const config = statusConfig[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma proposta encontrada</h3>
          <p className="text-sm text-muted-foreground">
            Crie uma proposta para visualizar analytics de engajamento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Proposal Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Selecionar Proposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={activeProposalId || ''}
            onValueChange={setSelectedProposalId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma proposta" />
            </SelectTrigger>
            <SelectContent>
              {proposals.map((proposal) => (
                <SelectItem key={proposal.id} value={proposal.id}>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {proposal.proposal_number || proposal.title || 'Proposta sem título'}
                    </span>
                    {getStatusBadge(proposal.status)}
                    {proposal.total_amount > 0 && (
                      <span className="text-muted-foreground text-sm">
                        R$ {proposal.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {activeProposalId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Analytics Panel - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <ProposalAnalyticsPanel proposalId={activeProposalId} />
          </div>

          {/* AI Insights & Alerts - 1 column */}
          <div className="space-y-6">
            <AIProposalInsightCard proposalId={activeProposalId} autoLoad opportunityId={opportunityId} />
            {/* Sprint C.1: ProposalAlertsCard removido — AI Insights é a única fonte. */}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecione uma proposta para ver analytics detalhados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
