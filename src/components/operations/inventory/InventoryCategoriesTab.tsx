import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Boxes, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  CATEGORY_CONTROL_MODE_LABEL,
  getCategoryControlMode,
} from '@/lib/operations/inventoryLabels';
import {
  useInventoryCategories,
  useInventoryCategoryMutations,
} from '@/hooks/operations/useInventoryCategories';
import type { InventoryCategory } from '@/services/operations/inventoryCategories';
import { InventoryCategoryFormDialog } from './InventoryCategoryFormDialog';

export function InventoryCategoriesTab() {
  const { data: categories, isLoading } = useInventoryCategories();
  const { toggle } = useInventoryCategoryMutations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCategory | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<InventoryCategory | null>(null);

  const filtered = useMemo(() => {
    let list = categories ?? [];
    if (statusFilter === 'active') list = list.filter((c) => c.is_active);
    if (statusFilter === 'inactive') list = list.filter((c) => !c.is_active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [categories, search, statusFilter]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: InventoryCategory) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const handleToggle = async () => {
    if (!confirmToggle) return;
    const next = !confirmToggle.is_active;
    try {
      await toggle.mutateAsync({ id: confirmToggle.id, isActive: next });
      toast.success(next ? 'Categoria ativada com sucesso.' : 'Categoria desativada com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setConfirmToggle(null);
    }
  };

  const isEmpty = !isLoading && (categories?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Categorias</h3>
          <p className="text-sm text-muted-foreground">
            Classifique os itens do inventário por tipo operacional, como roteadores, chips, access
            points, cabos e materiais de instalação.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          <EmptyState
            icon={Boxes}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar os itens do inventário, como roteadores, chips, cabos e materiais de instalação."
          />
          <div className="flex justify-center">
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova categoria
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo padrão</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma categoria encontrada com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{ITEM_KIND_LABEL[c.item_kind] ?? c.item_kind}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {c.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? 'default' : 'secondary'}>
                            {c.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.sort_order}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(c.updated_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(c)}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmToggle(c)}
                            >
                              {c.is_active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <InventoryCategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />

      <AlertDialog
        open={!!confirmToggle}
        onOpenChange={(open) => !open && setConfirmToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? 'Desativar categoria?' : 'Ativar categoria?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? 'Deseja desativar esta categoria? Ela não aparecerá como opção para novos itens, mas o histórico será preservado.'
                : 'Deseja reativar esta categoria? Ela voltará a aparecer como opção para novos itens.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
