import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send, Eye, Download, Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listProposals } from '@/services/supabase/proposals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProposalModal } from '@/components/proposals/ProposalModal';
import { ProposalViewModal } from '@/components/proposals/ProposalViewModal';

export default function Proposals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<any>(undefined);
  const [viewingProposal, setViewingProposal] = useState<any>(null);

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
          <Button onClick={() => { setEditingProposal(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Proposta
          </Button>
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
                      <TableCell>{proposal.opportunity?.account?.razao_social || '-'}</TableCell>
                      <TableCell>
                        {proposal.value ? `R$ ${proposal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell>{new Date(proposal.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setViewingProposal(proposal); setViewModalOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingProposal(proposal); setModalOpen(true); }}
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

      <ProposalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        proposal={editingProposal}
      />

      <ProposalViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        proposal={viewingProposal}
      />
    </Layout>
  );
}
