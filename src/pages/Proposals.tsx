import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Pencil, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listProposals } from '@/services/supabase/proposals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProposalViewModal } from '@/components/proposals/ProposalViewModal';
import { ProposalEditorModal } from '@/components/proposals/ProposalEditorModal';
import { ProposalTemplatesManager } from '@/components/proposals/ProposalTemplatesManager';
import { useNavigate } from 'react-router-dom';
import { formatDateBR } from '@/lib/dateUtils';

export default function Proposals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const navigate = useNavigate();

  const { data: proposalsData, isLoading } = useQuery({
    queryKey: ['proposals', searchQuery],
    queryFn: () => listProposals({ q: searchQuery }),
  });

  const proposals = proposalsData?.data || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      sent: { variant: 'default', label: 'Enviada' },
      viewed: { variant: 'outline', label: 'Visualizada' },
      accepted: { variant: 'default', label: 'Aceita' },
      rejected: { variant: 'destructive', label: 'Rejeitada' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Propostas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie propostas comerciais
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/app/settings/proposal-layouts')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Modelos Visuais
            </Button>
            <ProposalTemplatesManager />
            <Button onClick={() => {
              setSelectedProposal(null);
              setEditorModalOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Proposta
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <Input
              placeholder="Buscar propostas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma proposta encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal: any) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">{proposal.title || 'Sem título'}</TableCell>
                      <TableCell>{proposal.client_name || '-'}</TableCell>
                      <TableCell>
                        {proposal.total_amount ? `R$ ${proposal.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell>{formatDateBR(proposal.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedProposal(proposal); setViewModalOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedProposal(proposal); setEditorModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ProposalEditorModal
        open={editorModalOpen}
        onOpenChange={setEditorModalOpen}
        proposalId={selectedProposal?.id}
        onSuccess={() => {
          setEditorModalOpen(false);
          setSelectedProposal(null);
        }}
      />

      <ProposalViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        proposal={selectedProposal}
      />
    </Layout>
  );
}
