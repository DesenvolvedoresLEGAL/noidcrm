import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Pencil, Plus, Search } from 'lucide-react';
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
import { LOCATION_TYPE_LABEL } from '@/lib/operations/inventoryLabels';
import {
  useInventoryLocations,
  useInventoryLocationMutations,
} from '@/hooks/operations/useInventoryLocations';
import type { InventoryLocation } from '@/services/operations/inventoryLocations';
import { InventoryLocationFormDialog } from './InventoryLocationFormDialog';

export function InventoryLocationsTab() {
  const { data: locations, isLoading } = useInventoryLocations();
  const { toggle } = useInventoryLocationMutations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryLocation | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<InventoryLocation | null>(null);

  const filtered = useMemo(() => {
    let list = locations ?? [];
    if (statusFilter === 'active') list = list.filter((l) => l.is_active);
    if (statusFilter === 'inactive') list = list.filter((l) => !l.is_active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q));
    }
    return list;
  }, [locations, search, statusFilter]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (l: InventoryLocation) => {
    setEditing(l);
    setDialogOpen(true);
  };

  const handleToggle = async () => {
    if (!confirmToggle) return;
    const next = !confirmToggle.is_active;
    try {
      await toggle.mutateAsync({ id: confirmToggle.id, isActive: next });
      toast.success(next ? 'Local ativado com sucesso.' : 'Local desativado com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setConfirmToggle(null);
    }
  };

  const isEmpty = !isLoading && (locations?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Locais</h3>
          <p className="text-sm text-muted-foreground">
            Controle os locais físicos e operacionais onde os itens podem estar, como estoque,
            manutenção, técnico, evento ou baixa.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Novo local
        </Button>
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          <EmptyState
            icon={MapPin}
            title="Nenhum local cadastrado"
            description="Crie locais para controlar onde os itens do inventário estão fisicamente ou operacionalmente."
          />
          <div className="flex justify-center">
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo local
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
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo de local</TableHead>
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
                        Nenhum local encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>
                          {LOCATION_TYPE_LABEL[l.location_type] ?? l.location_type}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {l.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.is_active ? 'default' : 'secondary'}>
                            {l.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>{l.sort_order}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(l.updated_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(l)}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmToggle(l)}
                            >
                              {l.is_active ? 'Desativar' : 'Ativar'}
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

      <InventoryLocationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        location={editing}
      />

      <AlertDialog
        open={!!confirmToggle}
        onOpenChange={(open) => !open && setConfirmToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? 'Desativar local?' : 'Ativar local?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? 'Deseja desativar este local? Ele não aparecerá como opção para novos itens, mas o histórico será preservado.'
                : 'Deseja reativar este local? Ele voltará a aparecer como opção para novos itens.'}
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
