import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Building2, Download, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountRFMIntelligencePage } from '@/components/accounts/rfm/AccountRFMIntelligencePage';
import { PageHeader } from '@/components/ui/page-header';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { listAccounts, deleteAccount, getAccountsPorteSummary, type Account, type ScoreFinanceiroFilter } from '@/services/supabase/accounts';
import { supabase } from '@/integrations/supabase/client';
import { AccountModalTabs } from '@/components/accounts/AccountModalTabs';
import { AccountCard } from '@/components/accounts/AccountCard';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { extractEmail, extractPhone } from '@/lib/contactFormat';
import { accountKeys } from '@/lib/query-keys';
import { normalizePorte, CANONICAL_PORTES, type CanonicalPorte } from '@/lib/porte-normalizer';
import { useOrganizationTags } from '@/hooks/useOrganizationTags';
import { useAccountTagsBulk, useAccountIdsByTag } from '@/hooks/useAccountTags';
import { useDebounce } from '@/hooks/useDebounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Accounts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentoFilter, setSegmentoFilter] = useState<string>('all');
  const [porteFilter, setPorteFilter] = useState<string>('all');
  const [origemFilter, setOrigemFilter] = useState<string>('all');
  const [scoreFinanceiroFilter, setScoreFinanceiroFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 300);

  const PAGE_SIZE = 50;

  // Tag → account_ids server-side resolvido antes da query principal
  const { data: tagAccountIdsSet, isLoading: tagIdsLoading } = useAccountIdsByTag(
    tagFilter !== 'all' ? tagFilter : undefined,
  );
  const tagAccountIds = useMemo(
    () => (tagAccountIdsSet ? Array.from(tagAccountIdsSet) : undefined),
    [tagAccountIdsSet],
  );
  const tagFilterReady = tagFilter === 'all' || tagAccountIds !== undefined;

  // Reset page quando filtros/busca mudam
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, segmentoFilter, porteFilter, origemFilter, scoreFinanceiroFilter, tagFilter]);

  // Buscar contas — todos os filtros server-side, page_size fixo em 50
  const { data: accountsData, isLoading, isFetching, error: accountsError } = useQuery({
    queryKey: [
      ...accountKeys.lists(),
      debouncedSearchQuery,
      segmentoFilter,
      porteFilter,
      origemFilter,
      scoreFinanceiroFilter,
      tagFilter,
      // Hash leve da lista de ids para invalidar quando muda
      tagAccountIds ? `${tagAccountIds.length}` : 'no-tag',
      page,
    ],
    queryFn: async () => {
      try {
        const result = await listAccounts({
          q: debouncedSearchQuery,
          page,
          page_size: PAGE_SIZE,
          segmento: segmentoFilter !== 'all' ? segmentoFilter : undefined,
          porte: porteFilter !== 'all' ? porteFilter : undefined,
          origem_principal: origemFilter !== 'all' ? origemFilter : undefined,
          score_financeiro:
            scoreFinanceiroFilter !== 'all' ? (scoreFinanceiroFilter as ScoreFinanceiroFilter) : undefined,
          account_ids: tagFilter !== 'all' ? tagAccountIds : undefined,
        });

        if (import.meta.env.DEV) {
          console.log('[Accounts] Query successful:', {
            count: result.data.length,
            total: result.total,
            page,
            pageSize: PAGE_SIZE,
            query: debouncedSearchQuery,
            filters: { segmentoFilter, porteFilter, origemFilter, scoreFinanceiroFilter, tagFilter },
          });
        }

        return result;
      } catch (error) {
        console.error('[Accounts] Query failed:', error);
        throw error;
      }
    },
    enabled: tagFilterReady,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: 1000,
  });

  // KPIs agregados de toda a organização (sem paginação)
  const { data: porteSummary } = useQuery({
    queryKey: ['accounts-porte-summary'],
    queryFn: getAccountsPorteSummary,
    staleTime: 60_000,
  });

  // Buscar contatos para busca global
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-search', debouncedSearchQuery],
    queryFn: async () => {
      if (debouncedSearchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, nome, account_id, emails, telefones')
        .ilike('nome', `%${debouncedSearchQuery}%`)
        .limit(10);
      if (error) {
        console.error('[Accounts] Contacts search failed:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: debouncedSearchQuery.length >= 2,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      toast({ title: 'Conta excluída com sucesso' });
      setDeleteDialog(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  // Tags da organização (lookup id → name/color)
  const { tags: orgTags } = useOrganizationTags();
  // Tags por conta (bulk)
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const { data: tagsByAccount = {} } = useAccountTagsBulk(accountIds);
  const { data: accountCardData = {} } = useQuery({
    queryKey: ['account-card-data', accountIds.join(',')],
    queryFn: async () => {
      if (accountIds.length === 0) return {};

      const [opportunitiesResult, contactsResult] = await Promise.all([
        supabase
          .from('opportunities')
          .select('account_id, valor_previsto, status')
          .in('account_id', accountIds)
          .in('status', ['new', 'in_progress']),
        supabase
          .from('contacts')
          .select('id, account_id, nome, emails, telefones')
          .in('account_id', accountIds)
          .is('deleted_at', null)
          .order('nome'),
      ]);

      if (opportunitiesResult.error) {
        console.error('[Accounts] Account metrics failed:', opportunitiesResult.error);
      }
      if (contactsResult.error) {
        console.error('[Accounts] Account contacts preview failed:', contactsResult.error);
      }

      const grouped = accountIds.reduce((acc, id) => {
        acc[id] = { metrics: { opportunities: 0, contacts: 0, pipelineValue: 0 }, contacts: [] as any[] };
        return acc;
      }, {} as Record<string, { metrics: { opportunities: number; contacts: number; pipelineValue: number }; contacts: any[] }>);

      for (const opportunity of opportunitiesResult.data || []) {
        const accountId = opportunity.account_id;
        if (!accountId || !grouped[accountId]) continue;
        grouped[accountId].metrics.opportunities += 1;
        grouped[accountId].metrics.pipelineValue += Number(opportunity.valor_previsto || 0);
      }

      for (const contact of contactsResult.data || []) {
        const accountId = contact.account_id;
        if (!accountId || !grouped[accountId]) continue;
        grouped[accountId].metrics.contacts += 1;
        if (grouped[accountId].contacts.length < 3) grouped[accountId].contacts.push(contact);
      }

      return grouped;
    },
    enabled: accountIds.length > 0,
    staleTime: 30_000,
  });
  // Todos os filtros (score/tag inclusive) já são aplicados server-side em listAccounts.
  // A página exibe diretamente o que vem do banco.
  const filteredAccounts = accounts;

  // Extrair valores únicos para filtros
  const uniqueSegmentos = useMemo(() =>
    [...new Set(accounts.map(a => a.segmento).filter(Boolean))],
    [accounts]
  );

  const uniqueOrigens = useMemo(() =>
    [...new Set(accounts.map(a => a.origem_principal).filter(Boolean))],
    [accounts]
  );

  // Estatísticas por porte canônico — agregadas via RPC (org-wide, não pagina)
  const stats = useMemo(() => {
    return {
      total: porteSummary?.total ?? accountsData?.total ?? 0,
      mei: porteSummary?.mei ?? 0,
      me: porteSummary?.me ?? 0,
      epp: porteSummary?.epp ?? 0,
      medio: porteSummary?.medio ?? 0,
      grande: porteSummary?.grande ?? 0,
    };
  }, [porteSummary, accountsData]);

  // Export para CSV
  const handleExportCSV = () => {
    if (filteredAccounts.length === 0) {
      toast({ 
        variant: 'destructive',
        title: 'Nenhum dado para exportar' 
      });
      return;
    }

    const headers = ['Razão Social', 'Nome Fantasia', 'CNPJ', 'Segmento', 'Porte', 'Origem', 'Tags'];
    const rows = filteredAccounts.map(account => [
      account.razao_social,
      account.nome_fantasia || '',
      account.cnpj || '',
      account.segmento || '',
      account.porte || '',
      account.origem_principal || '',
      (tagsByAccount[account.id] || []).map(t => t.name).join(' | '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({ title: 'Arquivo CSV exportado com sucesso!' });
  };

  // Export para Excel (usando formato CSV com extensão .xlsx)
  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) {
      toast({ 
        variant: 'destructive',
        title: 'Nenhum dado para exportar' 
      });
      return;
    }

    const headers = ['Razão Social', 'Nome Fantasia', 'CNPJ', 'Segmento', 'Porte', 'Origem', 'Tags'];
    const rows = filteredAccounts.map(account => [
      account.razao_social,
      account.nome_fantasia || '',
      account.cnpj || '',
      account.segmento || '',
      account.porte || '',
      account.origem_principal || '',
      (tagsByAccount[account.id] || []).map(t => t.name).join(' | '),
    ]);

    const csvContent = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contas_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();

    toast({ title: 'Arquivo Excel exportado com sucesso!' });
  };

  const clearFilters = () => {
    setSegmentoFilter('all');
    setPorteFilter('all');
    setOrigemFilter('all');
    setScoreFinanceiroFilter('all');
    setTagFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = segmentoFilter !== 'all' || porteFilter !== 'all' || origemFilter !== 'all' || scoreFinanceiroFilter !== 'all' || tagFilter !== 'all' || searchQuery;

  const scoreFilterLabels: Record<string, string> = {
    excellent: 'Excelente (80–100)',
    good: 'Bom (60–79)',
    regular: 'Regular (40–59)',
    bad: 'Ruim (0–39)',
    none: 'Sem score',
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <PageHeader
          icon={Building2}
          title="Contas"
          subtitle="Gerencie empresas e relacionamentos comerciais"
          variant="emerald"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button onClick={() => { setEditingAccount(undefined); setModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="contas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="rfm">RFM Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MEI</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mei}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ME</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.me}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">EPP</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.epp}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Médio Porte</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.medio}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Grande Porte</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.grande}</div>
            </CardContent>
          </Card>
        </div>

        {/* Busca e Filtros */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contas ou contatos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant={showFilters ? 'default' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                )}
              </div>

              {/* Filtros Avançados */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t">
                  <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os segmentos</SelectItem>
                      {uniqueSegmentos.map(seg => (
                        <SelectItem key={seg} value={seg!}>{seg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={porteFilter} onValueChange={setPorteFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Porte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os portes</SelectItem>
                      {CANONICAL_PORTES.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={origemFilter} onValueChange={setOrigemFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as origens</SelectItem>
                      {uniqueOrigens.map(orig => (
                        <SelectItem key={orig} value={orig!}>{orig}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={scoreFinanceiroFilter} onValueChange={setScoreFinanceiroFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Score Financeiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os scores</SelectItem>
                      <SelectItem value="excellent">Excelente (80–100)</SelectItem>
                      <SelectItem value="good">Bom (60–79)</SelectItem>
                      <SelectItem value="regular">Regular (40–59)</SelectItem>
                      <SelectItem value="bad">Ruim (0–39)</SelectItem>
                      <SelectItem value="none">Sem score</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {orgTags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtros Ativos */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {searchQuery && (
                    <Badge variant="secondary">
                      Busca: {searchQuery}
                    </Badge>
                  )}
                  {segmentoFilter !== 'all' && (
                    <Badge variant="secondary">
                      Segmento: {segmentoFilter}
                    </Badge>
                  )}
                  {porteFilter !== 'all' && (
                    <Badge variant="secondary">
                      Porte: {porteFilter}
                    </Badge>
                  )}
                  {origemFilter !== 'all' && (
                    <Badge variant="secondary">
                      Origem: {origemFilter}
                    </Badge>
                  )}
                  {scoreFinanceiroFilter !== 'all' && (
                    <Badge variant="secondary">
                      Score: {scoreFilterLabels[scoreFinanceiroFilter]}
                    </Badge>
                  )}
                  {tagFilter !== 'all' && (
                    <Badge variant="secondary">
                      Tag: {orgTags.find(t => t.id === tagFilter)?.name || tagFilter}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-3" />
                <p className="text-muted-foreground">Carregando contas...</p>
              </div>
            ) : accountsError ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-destructive/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-destructive">
                  Erro ao carregar contas
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {accountsError instanceof Error ? accountsError.message : 'Ocorreu um erro inesperado ao buscar as contas'}
                </p>
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: accountKeys.lists() })}>
                  Tentar Novamente
                </Button>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {hasActiveFilters ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {hasActiveFilters 
                    ? 'Tente ajustar os filtros de busca ou limpar todos os filtros'
                    : 'Comece criando sua primeira conta cliente para gerenciar relacionamentos comerciais'
                  }
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                ) : (
                  <Button onClick={() => { setEditingAccount(undefined); setModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Conta
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Resultados de Busca de Contatos */}
                {contacts.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                      Contatos encontrados ({contacts.length})
                    </h3>
                    <div className="grid gap-3">
                      {contacts.map(contact => (
                        <Card 
                          key={contact.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => contact.account_id && navigate(`/app/accounts/${contact.account_id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">
                                  {contact.nome.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{contact.nome}</p>
                                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                  {extractEmail(contact.emails) && <span>{extractEmail(contact.emails)}</span>}
                                  {extractPhone(contact.telefones) && <span>{extractPhone(contact.telefones)}</span>}
                                </div>
                              </div>
                              <Badge variant="outline">Contato</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="my-6 border-t" />
                  </div>
                )}

                {/* Grid de Cards de Contas */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                    Contas ({filteredAccounts.length}{!hasClientSideFilters && accountsData?.total ? ` de ${accountsData.total}` : ''})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        metrics={accountCardData[account.id]?.metrics}
                        contactsPreview={accountCardData[account.id]?.contacts}
                        tags={tagsByAccount[account.id] || []}
                        onView={() => navigate(`/app/accounts/${account.id}`)}
                        onEdit={() => {
                          setEditingAccount(account);
                          setModalOpen(true);
                        }}
                        onDelete={() => setDeleteDialog(account.id)}
                      />
                    ))}
                  </div>

                  {/* Paginação server-side (desabilitada quando há filtros client-side ativos) */}
                  {!hasClientSideFilters && (accountsData?.total ?? 0) > PAGE_SIZE && (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, accountsData?.total ?? 0)} de {accountsData?.total ?? 0}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1 || isFetching}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          Página {page} de {Math.max(1, Math.ceil((accountsData?.total ?? 0) / PAGE_SIZE))}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const totalPages = Math.max(1, Math.ceil((accountsData?.total ?? 0) / PAGE_SIZE));
                            setPage((p) => Math.min(totalPages, p + 1));
                          }}
                          disabled={page >= Math.ceil((accountsData?.total ?? 0) / PAGE_SIZE) || isFetching}
                        >
                          Próxima
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {hasClientSideFilters && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Filtros de Score/Tag aplicados em até {PAGE_SIZE} contas carregadas. Para resultados completos, remova esses filtros.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="rfm">
            <AccountRFMIntelligencePage />
          </TabsContent>
        </Tabs>
      </div>

      <AccountModalTabs
        open={modalOpen}
        onOpenChange={setModalOpen}
        account={editingAccount}
      />

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              Todos os contatos, oportunidades e atividades relacionadas serão mantidos mas
              desvinculados desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
