import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import {
  useInventoryFamilies,
  useInventoryFamilyMutations,
} from '@/hooks/operations/useInventoryFamilies';
import type { InventoryFamily } from '@/services/operations/inventoryFamilies';
import { InventoryFamilyFormDialog } from './InventoryFamilyFormDialog';

export function InventoryFamiliesTab() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { data: categories } = useInventoryCategories();
  const { data: families, isLoading } = useInventoryFamilies(
    categoryFilter === 'all' ? undefined : categoryFilter,
  );
  const { toggle } = useInventoryFamilyMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryFamily | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<InventoryFamily | null>(null);

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );
  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const isEmpty = !isLoading && (families?.length ?? 0) === 0;
  const noCategories = activeCategories.length === 0;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (f: InventoryFamily) => {
    setEditing(f);
    setDialogOpen(true);
  };

  const handleToggle = async () => {
    if (!confirmToggle) return;
    const next = !confirmToggle.is_active;
    try {
      await toggle.mutateAsync({ id: confirmToggle.id, isActive: next });
      toast.success(next ? 'Família ativada com sucesso.' : 'Família desativada com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível concluir a ação.');
    } finally {
      setConfirmToggle(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Famílias</h3>
          <p className="text-sm text-muted-foreground">
            Subdivisões dentro de cada categoria, ex.: Roteadores, Switches e Antenas dentro de Conectividade.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0" disabled={noCategories}>
          <Plus className="h-4 w-4" /> Nova família
        </Button>
      </div>

      {noCategories && (
        <p className="text-sm text-muted-foreground">
          Cadastre uma categoria antes de criar famílias.
        </p>
      )}

      {isEmpty && !noCategories ? (
        <div className="space-y-4">
          <EmptyState
            icon={FolderTree}
            title="Nenhuma família cadastrada"
            description="Crie famílias dentro das categorias para organizar melhor o inventário."
          />
          <div className="flex justify-center">
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova família
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Atualizada em</TableHead>
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
                  ) : (families ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma família encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (families ?? []).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {categoryById.get(f.category_id) ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{f.slug}</TableCell>
                        <TableCell>
                          <Badge variant={f.is_active ? 'default' : 'secondary'}>
                            {f.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>{f.sort_order}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(f.updated_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(f)} className="gap-1">
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setConfirmToggle(f)}>
                              {f.is_active ? 'Desativar' : 'Ativar'}
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

      <InventoryFamilyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        family={editing}
        defaultCategoryId={categoryFilter !== 'all' ? categoryFilter : undefined}
      />

      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? 'Desativar família?' : 'Ativar família?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? 'A família deixará de aparecer como opção em novos itens.'
                : 'A família voltará a aparecer como opção em novos itens.'}
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
