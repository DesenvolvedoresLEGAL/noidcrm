import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Send,
  FileDown,
  Link as LinkIcon,
} from 'lucide-react';
import { listProposals, deleteProposal, duplicateProposal, generateProposalPDF, generatePublicToken } from '@/services/crm/proposals';
import { toast } from 'sonner';
import { ProposalEditorModal } from './ProposalEditorModal';
import { ProposalViewModal } from './ProposalViewModal';
import { formatDateBR } from '@/lib/dateUtils';

interface ProposalsListProps {
  opportunityId: string;
}

export function ProposalsList({ opportunityId }: ProposalsListProps) {
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: proposalsData, isLoading } = useQuery({
    queryKey: ['proposals', opportunityId],
    queryFn: () => listProposals({ opportunityId }),
  });

  const proposals = proposalsData?.data || [];

  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      toast.success('Proposta excluída!');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir proposta');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      toast.success('Proposta duplicada!');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao duplicar proposta');
    },
  });

  const handleGeneratePDF = async (proposalId: string) => {
    try {
      const pdfUrl = await generateProposalPDF(proposalId);
      window.open(pdfUrl, '_blank');
      toast.success('PDF gerado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar PDF');
    }
  };

  const handleGeneratePublicLink = async (proposalId: string) => {
    try {
      const token = await generatePublicToken(proposalId);
      const publicUrl = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link público copiado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar link');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: 'secondary', label: 'Rascunho', color: 'bg-gray-100 text-gray-800' },
      sent: { variant: 'default', label: 'Enviada', color: 'bg-blue-100 text-blue-800' },
      viewed: { variant: 'outline', label: 'Visualizada', color: 'bg-yellow-100 text-yellow-800' },
      accepted: { variant: 'default', label: 'Aceita', color: 'bg-green-100 text-green-800' },
      rejected: { variant: 'destructive', label: 'Rejeitada', color: 'bg-red-100 text-red-800' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Calculate metrics
  const totalProposals = proposals.length;
  const acceptedProposals = proposals.filter((p: any) => p.status === 'accepted').length;
  const conversionRate = totalProposals > 0 ? (acceptedProposals / totalProposals) * 100 : 0;
  const avgValue = proposals.length > 0
    ? proposals.reduce((sum: number, p: any) => sum + (p.total_amount || p.value || 0), 0) / proposals.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalProposals}</div>
            <div className="text-sm text-muted-foreground">Total de Propostas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{conversionRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Taxa de Conversão</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              R$ {avgValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">Valor Médio</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => {
          setSelectedProposal(null);
          setEditorModalOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      {/* Proposals Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-2">Nenhuma proposta criada ainda</p>
              <p className="text-sm">Clique em "Nova Proposta" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal: any) => (
                  <TableRow key={proposal.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{proposal.title || 'Sem título'}</div>
                        {proposal.version && proposal.version > 1 && (
                          <div className="text-xs text-muted-foreground">v{proposal.version}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                    <TableCell>
                      {proposal.total_amount ? (
                        <div className="font-medium">
                          R$ {proposal.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{proposal.items_count || 0} itens</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDateBR(proposal.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setViewModalOpen(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setEditorModalOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(proposal.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneratePDF(proposal.id)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Gerar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneratePublicLink(proposal.id)}>
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Link Público
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(proposal.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ProposalEditorModal
        open={editorModalOpen}
        onOpenChange={setEditorModalOpen}
        proposalId={selectedProposal?.id}
        opportunityId={opportunityId}
        onSuccess={() => {
          setEditorModalOpen(false);
          setSelectedProposal(null);
          queryClient.invalidateQueries({ queryKey: ['proposals'] });
        }}
      />

      <ProposalViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        proposal={selectedProposal}
      />
    </div>
  );
}
