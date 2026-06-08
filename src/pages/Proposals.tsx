import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Link2,
  FileDown,
  Copy,
  MoreHorizontal,
  Files,
  ExternalLink,
  FileSearch,
  X,
} from 'lucide-react';
import { useQuery, keepPreviousData, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchProposalsGlobal,
  duplicateProposal,
  generateProposalPDF,
  generatePublicToken,
} from '@/services/supabase/proposals';
import { buildProposalPublicUrl, buildProposalDirectUrl } from '@/lib/proposalUrl';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { proposalKeys } from '@/lib/query-keys';
import { ProposalViewModal } from '@/components/proposals/ProposalViewModal';
import { ProposalEditorModal } from '@/components/proposals/ProposalEditorModal';
import { formatDateBR } from '@/lib/dateUtils';
import { useDebounce } from '@/hooks/useDebounce';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviada' },
  { value: 'viewed', label: 'Visualizada' },
  { value: 'accepted', label: 'Aceita' },
  { value: 'rejected', label: 'Recusada' },
];

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: any; label: string }> = {
    draft: { variant: 'secondary', label: 'Rascunho' },
    sent: { variant: 'default', label: 'Enviada' },
    viewed: { variant: 'outline', label: 'Visualizada' },
    accepted: { variant: 'default', label: 'Aceita' },
    rejected: { variant: 'destructive', label: 'Recusada' },
  };
  const config = variants[status] || { variant: 'secondary', label: status || '—' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function copyToClipboard(text: string, message: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(message))
    .catch(() => toast.error('Não foi possível copiar'));
}

export default function Proposals() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');

  const debouncedMin = useDebounce(minValue, 400);
  const debouncedMax = useDebounce(maxValue, 400);

  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  const { data: activeUsers = [] } = useActiveUsers();

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, yearFilter, ownerFilter, debouncedMin, debouncedMax]);

  const queryParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      year: yearFilter !== 'all' ? Number(yearFilter) : undefined,
      ownerId: ownerFilter !== 'all' ? ownerFilter : undefined,
      minValue: debouncedMin ? Number(debouncedMin) : undefined,
      maxValue: debouncedMax ? Number(debouncedMax) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, statusFilter, yearFilter, ownerFilter, debouncedMin, debouncedMax, page]
  );

  const { data: proposalsData, isLoading, isFetching } = useQuery({
    queryKey: [...proposalKeys.lists(), 'global-search', queryParams],
    queryFn: () => searchProposalsGlobal(queryParams),
    placeholderData: keepPreviousData,
  });

  const proposals = proposalsData?.data || [];
  const total = proposalsData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);

  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      toast.success('Proposta duplicada!');
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao duplicar proposta'),
  });

  const handleDownloadPDF = async (proposalId: string) => {
    try {
      const pdfUrl = await generateProposalPDF(proposalId);
      window.open(pdfUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar PDF');
    }
  };

  const handleCopyPublicLink = async (proposalId: string) => {
    try {
      const token = await generatePublicToken(proposalId);
      copyToClipboard(buildProposalPublicUrl(token), 'Link público copiado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar link');
    }
  };

  const handleOpenPublicLink = async (proposalId: string) => {
    try {
      const token = await generatePublicToken(proposalId);
      window.open(buildProposalDirectUrl(token), '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao abrir link');
    }
  };

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(now - i));
  }, []);

  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of activeUsers as any[]) {
      map.set(u.user_id, u.full_name || u.email || '—');
    }
    return map;
  }, [activeUsers]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setYearFilter('all');
    setOwnerFilter('all');
    setMinValue('');
    setMaxValue('');
  };

  const hasActiveFilters =
    searchQuery ||
    statusFilter !== 'all' ||
    yearFilter !== 'all' ||
    ownerFilter !== 'all' ||
    minValue ||
    maxValue;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Propostas</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Central de propostas — busque por evento, cliente, código, produto ou qualquer palavra-chave.
          </p>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Busque por evento, cliente, código, produto ou palavra-chave"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-14 text-base bg-muted/30 border-border/60 focus-visible:bg-background"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {(activeUsers as any[]).map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                inputMode="decimal"
                placeholder="Valor mínimo"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Valor máximo"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
              />

              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between pb-3 text-sm text-muted-foreground">
              <span>
                {isLoading
                  ? 'Buscando...'
                  : total === 0
                  ? 'Nenhum resultado'
                  : `${total} proposta${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`}
              </span>
              {isFetching && !isLoading && <span className="text-xs">Atualizando…</span>}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileSearch className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Nenhuma proposta encontrada</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Tente outra palavra-chave, ajuste os filtros ou limpe a busca.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-md border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Código</TableHead>
                        <TableHead>Proposta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-right w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposals.map((proposal: any) => {
                        const account = proposal.opportunity?.account;
                        const clientLabel =
                          account?.nome_fantasia ||
                          account?.razao_social ||
                          proposal.client_name ||
                          '—';
                        const ownerId = proposal.opportunity?.owner_user_id;
                        const ownerName = ownerId ? ownerNameById.get(ownerId) || '—' : '—';
                        const value = proposal.total_amount ?? proposal.value;
                        const code = proposal.proposal_number || proposal.id.slice(0, 8);

                        return (
                          <TableRow key={proposal.id}>
                            <TableCell className="font-mono text-xs">
                              <button
                                onClick={() => copyToClipboard(code, 'Código copiado!')}
                                className="hover:underline"
                                title="Copiar código"
                              >
                                {code}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium max-w-[280px]">
                              <div className="truncate" title={proposal.title || ''}>
                                {proposal.title || 'Sem título'}
                              </div>
                              {proposal.opportunity?.title && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {proposal.opportunity.title}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={clientLabel}>
                              {clientLabel}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{ownerName}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(value)}</TableCell>
                            <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateBR(proposal.created_at)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {proposal.expires_at ? formatDateBR(proposal.expires_at) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedProposal(proposal);
                                    setViewModalOpen(true);
                                  }}
                                  title="Abrir proposta"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Mais ações">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={() => handleOpenPublicLink(proposal.id)}>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Abrir link público
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopyPublicLink(proposal.id)}>
                                      <Link2 className="h-4 w-4 mr-2" />
                                      Copiar link público
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDownloadPDF(proposal.id)}>
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Baixar PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => copyToClipboard(code, 'Código copiado!')}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copiar código
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => duplicateMutation.mutate(proposal.id)}
                                      disabled={duplicateMutation.isPending}
                                    >
                                      <Files className="h-4 w-4 mr-2" />
                                      Duplicar proposta
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {proposals.map((proposal: any) => {
                    const account = proposal.opportunity?.account;
                    const clientLabel =
                      account?.nome_fantasia ||
                      account?.razao_social ||
                      proposal.client_name ||
                      '—';
                    const value = proposal.total_amount ?? proposal.value;
                    const code = proposal.proposal_number || proposal.id.slice(0, 8);

                    return (
                      <div key={proposal.id} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[10px] text-muted-foreground">{code}</p>
                            <p className="font-medium text-sm truncate">{proposal.title || 'Sem título'}</p>
                            <p className="text-xs text-muted-foreground truncate">{clientLabel}</p>
                          </div>
                          {getStatusBadge(proposal.status)}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{formatMoney(value)}</div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateBR(proposal.created_at)}
                          </span>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedProposal(proposal);
                              setViewModalOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Abrir
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleOpenPublicLink(proposal.id)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Abrir link público
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyPublicLink(proposal.id)}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copiar link público
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPDF(proposal.id)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Baixar PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => copyToClipboard(code, 'Código copiado!')}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar código
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => duplicateMutation.mutate(proposal.id)}
                                disabled={duplicateMutation.isPending}
                              >
                                <Files className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    {total === 0 ? 'Nenhum resultado' : `Exibindo ${fromRow}–${toRow} de ${total}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
