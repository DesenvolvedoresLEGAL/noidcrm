import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTrash, EntityType, DeletedItem } from '@/hooks/useTrash';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, RotateCcw, Search, Package, AlertTriangle, Clock, Loader2, Building2, User, FileText, Target, Calendar } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getEntityLabel } from '@/services/supabase/trash';

const entityIcons: Record<EntityType, React.ReactNode> = {
  opportunities: <Target className="h-4 w-4" />,
  proposals: <FileText className="h-4 w-4" />,
  accounts: <Building2 className="h-4 w-4" />,
  contacts: <User className="h-4 w-4" />,
  activities: <Calendar className="h-4 w-4" />,
  contracts: <FileText className="h-4 w-4" />,
};

const entityColors: Record<EntityType, string> = {
  opportunities: 'bg-blue-500/10 text-blue-600 border-blue-200',
  proposals: 'bg-purple-500/10 text-purple-600 border-purple-200',
  accounts: 'bg-green-500/10 text-green-600 border-green-200',
  contacts: 'bg-orange-500/10 text-orange-600 border-orange-200',
  activities: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  contracts: 'bg-pink-500/10 text-pink-600 border-pink-200',
};

export default function Trash() {
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemToRestore, setItemToRestore] = useState<DeletedItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DeletedItem | null>(null);
  const [showBulkRestore, setShowBulkRestore] = useState(false);

  const {
    deletedItems,
    isLoading,
    stats,
    restore,
    isRestoring,
    restoreMultiple,
    isRestoringMultiple,
    permanentDelete,
    isPermanentlyDeleting,
  } = useTrash({
    entityType: entityTypeFilter === 'all' ? undefined : entityTypeFilter,
    search: search || undefined,
  });

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === deletedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(deletedItems.map(item => item.id)));
    }
  };

  const handleRestore = (item: DeletedItem) => {
    setItemToRestore(item);
  };

  const confirmRestore = () => {
    if (itemToRestore) {
      restore(itemToRestore.id);
      setItemToRestore(null);
    }
  };

  const handleBulkRestore = () => {
    if (selectedItems.size > 0) {
      setShowBulkRestore(true);
    }
  };

  const confirmBulkRestore = () => {
    restoreMultiple(Array.from(selectedItems));
    setSelectedItems(new Set());
    setShowBulkRestore(false);
  };

  const handlePermanentDelete = (item: DeletedItem) => {
    setItemToDelete(item);
  };

  const confirmPermanentDelete = () => {
    if (itemToDelete) {
      permanentDelete(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const getExpiryBadge = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      return <Badge variant="destructive" className="text-xs">Expirado</Badge>;
    }
    if (daysUntilExpiry <= 7) {
      return <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Expira em {daysUntilExpiry}d</Badge>;
    }
    return <Badge variant="outline" className="text-xs text-muted-foreground">{daysUntilExpiry}d restantes</Badge>;
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-muted-foreground" />
              Lixeira
            </h1>
            <p className="text-muted-foreground mt-1">
              Itens excluídos são mantidos por 90 dias antes de serem removidos permanentemente.
            </p>
          </div>

          {selectedItems.size > 0 && (
            <Button onClick={handleBulkRestore} disabled={isRestoringMultiple}>
              {isRestoringMultiple ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Restaurar {selectedItems.size} selecionado(s)
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total na Lixeira</CardDescription>
                <CardTitle className="text-2xl">{stats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Oportunidades</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  {stats.byType.opportunities || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Propostas</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  {stats.byType.proposals || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={stats.expiringSoon > 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expiram em 7 dias
                </CardDescription>
                <CardTitle className="text-2xl">{stats.expiringSoon}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar itens excluídos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={entityTypeFilter} onValueChange={(v) => setEntityTypeFilter(v as EntityType | 'all')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="opportunities">Oportunidades</SelectItem>
                  <SelectItem value="proposals">Propostas</SelectItem>
                  <SelectItem value="accounts">Empresas</SelectItem>
                  <SelectItem value="contacts">Contatos</SelectItem>
                  <SelectItem value="activities">Atividades</SelectItem>
                  <SelectItem value="contracts">Contratos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : deletedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">Lixeira vazia</h3>
                <p className="text-muted-foreground">
                  {search || entityTypeFilter !== 'all' 
                    ? 'Nenhum item encontrado com os filtros selecionados.'
                    : 'Não há itens excluídos para exibir.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedItems.size === deletedItems.length && deletedItems.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Excluído em</TableHead>
                      <TableHead>Excluído por</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${entityColors[item.entity_type as EntityType]} flex items-center gap-1 w-fit`}
                          >
                            {entityIcons[item.entity_type as EntityType]}
                            {getEntityLabel(item.entity_type as EntityType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(item.deleted_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.actor_name || 'Sistema'}
                        </TableCell>
                        <TableCell>
                          {getExpiryBadge(item.expires_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRestore(item)}
                              disabled={isRestoring}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restaurar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handlePermanentDelete(item)}
                              disabled={isPermanentlyDeleting}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={!!itemToRestore} onOpenChange={() => setItemToRestore(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar item?</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja restaurar "{itemToRestore?.title}"? O item voltará para seu local original.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRestore}>
                Restaurar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Restore Confirmation Dialog */}
        <AlertDialog open={showBulkRestore} onOpenChange={setShowBulkRestore}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar {selectedItems.size} itens?</AlertDialogTitle>
              <AlertDialogDescription>
                Todos os itens selecionados serão restaurados para seus locais originais.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBulkRestore}>
                Restaurar Todos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permanent Delete Confirmation Dialog */}
        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Excluir permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong>Esta ação não pode ser desfeita.</strong>
                <br /><br />
                O item "{itemToDelete?.title}" será removido permanentemente e não poderá ser recuperado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmPermanentDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
