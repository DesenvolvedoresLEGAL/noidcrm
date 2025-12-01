import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Building2, Download, Filter, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAccounts, deleteAccount, type Account } from '@/services/supabase/accounts';
import { supabase } from '@/integrations/supabase/client';
import { AccountModalTabs } from '@/components/accounts/AccountModalTabs';
import { AccountCard } from '@/components/accounts/AccountCard';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
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
  const [tamanhoFilter, setTamanhoFilter] = useState<string>('all');
  const [origemFilter, setOrigemFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Buscar contas com tratamento de erro
  const { data: accountsData, isLoading, error: accountsError } = useQuery({
    queryKey: ['accounts', searchQuery],
    queryFn: async () => {
      try {
        const result = await listAccounts({ q: searchQuery, page_size: 10000 });
        
        // Log para debug em desenvolvimento
        if (import.meta.env.DEV) {
          console.log('[Accounts] Query successful:', {
            count: result.data.length,
            total: result.total,
            query: searchQuery
          });
        }
        
        return result;
      } catch (error) {
        console.error('[Accounts] Query failed:', error);
        throw error;
      }
    },
    retry: 2,
    retryDelay: 1000,
  });

  // Buscar contatos para busca global
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      
      const { data } = await supabase
        .from('contacts')
        .select('id, nome, account_id, emails, telefones')
        .or(`nome.ilike.%${searchQuery}%,emails.cs.{${searchQuery}}`)
        .limit(10);
      
      return data || [];
    },
    enabled: searchQuery.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta excluída com sucesso' });
      setDeleteDialog(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const accounts = accountsData?.data || [];

  // Filtrar contas localmente
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      if (segmentoFilter !== 'all' && account.segmento !== segmentoFilter) return false;
      if (tamanhoFilter !== 'all' && account.tamanho !== tamanhoFilter) return false;
      if (origemFilter !== 'all' && account.origem_principal !== origemFilter) return false;
      return true;
    });
  }, [accounts, segmentoFilter, tamanhoFilter, origemFilter]);

  // Extrair valores únicos para filtros
  const uniqueSegmentos = useMemo(() => 
    [...new Set(accounts.map(a => a.segmento).filter(Boolean))],
    [accounts]
  );
  
  const uniqueTamanhos = useMemo(() => 
    [...new Set(accounts.map(a => a.tamanho).filter(Boolean))],
    [accounts]
  );
  
  const uniqueOrigens = useMemo(() => 
    [...new Set(accounts.map(a => a.origem_principal).filter(Boolean))],
    [accounts]
  );

  // Estatísticas
  const stats = useMemo(() => ({
    total: accountsData?.total || filteredAccounts.length,
    pequenas: filteredAccounts.filter(a => a.tamanho === 'Pequeno').length,
    medias: filteredAccounts.filter(a => a.tamanho === 'Médio').length,
    grandes: filteredAccounts.filter(a => a.tamanho === 'Grande').length,
    enterprise: filteredAccounts.filter(a => a.tamanho === 'Enterprise').length,
  }), [accountsData, filteredAccounts]);

  // Export para CSV
  const handleExportCSV = () => {
    if (filteredAccounts.length === 0) {
      toast({ 
        variant: 'destructive',
        title: 'Nenhum dado para exportar' 
      });
      return;
    }

    const headers = ['Razão Social', 'Nome Fantasia', 'CNPJ', 'Segmento', 'Tamanho', 'Origem'];
    const rows = filteredAccounts.map(account => [
      account.razao_social,
      account.nome_fantasia || '',
      account.cnpj || '',
      account.segmento || '',
      account.tamanho || '',
      account.origem_principal || '',
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

    const headers = ['Razão Social', 'Nome Fantasia', 'CNPJ', 'Segmento', 'Tamanho', 'Origem'];
    const rows = filteredAccounts.map(account => [
      account.razao_social,
      account.nome_fantasia || '',
      account.cnpj || '',
      account.segmento || '',
      account.tamanho || '',
      account.origem_principal || '',
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
    setTamanhoFilter('all');
    setOrigemFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = segmentoFilter !== 'all' || tamanhoFilter !== 'all' || origemFilter !== 'all' || searchQuery;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Contas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie empresas e relacionamentos comerciais
            </p>
          </div>
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
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5">
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
              <CardTitle className="text-sm font-medium">Pequenas</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pequenas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Médias</CardTitle>
              <Building2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.medias}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Grandes</CardTitle>
              <Building2 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.grandes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enterprise</CardTitle>
              <Building2 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.enterprise}</div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t">
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

                  <Select value={tamanhoFilter} onValueChange={setTamanhoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tamanhos</SelectItem>
                      {uniqueTamanhos.map(tam => (
                        <SelectItem key={tam} value={tam!}>{tam}</SelectItem>
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
                  {tamanhoFilter !== 'all' && (
                    <Badge variant="secondary">
                      Tamanho: {tamanhoFilter}
                    </Badge>
                  )}
                  {origemFilter !== 'all' && (
                    <Badge variant="secondary">
                      Origem: {origemFilter}
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
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['accounts'] })}>
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
                                  {contact.emails?.[0] && <span>{contact.emails[0]}</span>}
                                  {contact.telefones?.[0] && <span>{contact.telefones[0]}</span>}
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
                    Contas ({filteredAccounts.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onView={() => navigate(`/app/accounts/${account.id}`)}
                        onEdit={() => {
                          setEditingAccount(account);
                          setModalOpen(true);
                        }}
                        onDelete={() => setDeleteDialog(account.id)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
