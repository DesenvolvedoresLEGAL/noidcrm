import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listProposals } from '@/services/supabase/proposals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { proposalKeys } from '@/lib/query-keys';
import { ProposalViewModal } from '@/components/proposals/ProposalViewModal';
import { ProposalEditorModal } from '@/components/proposals/ProposalEditorModal';
import { formatDateBR } from '@/lib/dateUtils';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 50;

export default function Proposals() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  // Reset to first page whenever search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: proposalsData, isLoading } = useQuery({
    queryKey: [...proposalKeys.lists(), { q: debouncedSearch, page, pageSize: PAGE_SIZE }],
    queryFn: () => listProposals({ q: debouncedSearch, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const proposals = proposalsData?.data || [];
  const total = proposalsData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);

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
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Propostas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Visualize e gerencie suas propostas
          </p>
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
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
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
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedProposal(proposal); setViewModalOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedProposal(proposal); setEditorModalOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {proposals.map((proposal: any) => (
                    <div key={proposal.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{proposal.title || 'Sem título'}</p>
                          <p className="text-xs text-muted-foreground">{proposal.client_name || '-'}</p>
                        </div>
                        {getStatusBadge(proposal.status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {proposal.total_amount ? `R$ ${proposal.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateBR(proposal.created_at)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedProposal(proposal); setViewModalOpen(true); }}>
                          <Eye className="h-3.5 w-3.5 mr-1.5" />
                          Ver
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedProposal(proposal); setEditorModalOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
