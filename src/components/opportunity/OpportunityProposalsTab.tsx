import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Eye, Pencil, ExternalLink } from 'lucide-react';
import { listProposals } from '@/services/crm/proposals';
import { formatDateBR } from '@/lib/dateUtils';

interface OpportunityProposalsTabProps {
  opportunityId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'default' },
  viewed: { label: 'Visualizada', variant: 'outline' },
  accepted: { label: 'Aceita', variant: 'default' },
  rejected: { label: 'Recusada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'destructive' },
};

export function OpportunityProposalsTab({ opportunityId }: OpportunityProposalsTabProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', opportunityId],
    queryFn: () => listProposals({ opportunityId }),
  });

  const proposals = data?.data || [];

  const handleNewProposal = () => {
    navigate(`/app/proposals/new?opportunity_id=${opportunityId}`);
  };

  const handleEditProposal = (proposalId: string) => {
    navigate(`/app/proposals/${proposalId}/edit`);
  };

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    const symbols: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' };
    return `${symbols[currency] || 'R$'} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Propostas</h3>
        <Button onClick={handleNewProposal} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h4 className="text-lg font-medium mb-2">Nenhuma proposta</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Crie uma proposta para esta oportunidade
            </p>
            <Button onClick={handleNewProposal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Proposta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal: any) => {
            const statusInfo = statusConfig[proposal.status] || statusConfig.draft;
            return (
              <Card 
                key={proposal.id} 
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleEditProposal(proposal.id)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{proposal.title}</p>
                        {proposal.proposal_number && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {proposal.proposal_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatCurrency(proposal.value || 0, proposal.currency)}</span>
                        <span>•</span>
                        <span>{formatDateBR(proposal.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProposal(proposal.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
