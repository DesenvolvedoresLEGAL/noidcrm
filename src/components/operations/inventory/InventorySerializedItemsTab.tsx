import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Package, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ITEM_STATUS_LABEL,
  ITEM_STATUS_OPTIONS,
  getStatusBadgeVariant,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';
import {
  CRITICALITY_LABELS,
  CRITICALITY_OPTIONS,
  OPERATIONAL_TYPE_LABELS,
  OPERATIONAL_TYPE_OPTIONS,
  criticalityBadgeVariant,
  type Criticality,
  type OperationalType,
} from '@/lib/operations/inventoryClassification';
import { useInventoryItems } from '@/hooks/operations/useInventoryItems';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilies } from '@/hooks/operations/useInventoryFamilies';
import { useInventoryLocations } from '@/hooks/operations/useInventoryLocations';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';
import { InventoryItemFormDialog } from './InventoryItemFormDialog';
import { InventoryItemStatusDialog } from './InventoryItemStatusDialog';
import { getTechnicalSpecs } from '@/lib/operations/inventoryTechnicalSpecs';

export function InventorySerializedItemsTab() {
  const { data: items, isLoading } = useInventoryItems();
  const { data: categories } = useInventoryCategories();
  const { data: locations } = useInventoryLocations();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InventoryItemStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemWithRefs | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusItem, setStatusItem] = useState<InventoryItemWithRefs | null>(null);

  const serializedCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active && c.item_kind === 'serialized'),
    [categories],
  );
  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.is_active),
    [locations],
  );

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (categoryFilter !== 'all') list = list.filter((i) => i.category_id === categoryFilter);
    if (locationFilter !== 'all') list = list.filter((i) => i.location_id === locationFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        [i.name, i.asset_code, i.serial_number, i.brand, i.model]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [items, search, statusFilter, categoryFilter, locationFilter]);

  const isEmpty = !isLoading && (items?.length ?? 0) === 0;
  const noCategories = serializedCategories.length === 0;
  const noLocations = activeLocations.length === 0;
  const cantCreate = noCategories || noLocations;
  const cantCreateReason = noCategories
    ? 'Cadastre uma categoria serializada antes de criar itens.'
    : noLocations
    ? 'Cadastre um local antes de criar itens.'
    : '';

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (it: InventoryItemWithRefs) => {
    setEditing(it);
    setFormOpen(true);
  };
  const openStatus = (it: InventoryItemWithRefs) => {
    setStatusItem(it);
    setStatusOpen(true);
  };

  const NewItemBtn = (
    <Button onClick={openNew} className="gap-2 shrink-0" disabled={cantCreate}>
      <Plus className="h-4 w-4" /> Novo item
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Itens</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre e controle os ativos físicos únicos do inventário, como roteadores, access
            points, switches, nobreaks, tablets e totens.
          </p>
        </div>
        {cantCreate ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{NewItemBtn}</span>
              </TooltipTrigger>
              <TooltipContent>{cantCreateReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          NewItemBtn
        )}
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          <EmptyState
            icon={Package}
            title="Nenhum item serializado cadastrado"
            description="Cadastre ativos físicos únicos do inventário, como roteadores, access points, switches, nobreaks, tablets e totens."
          />
          <div className="flex justify-center">
            {cantCreate ? (
              <p className="text-sm text-muted-foreground">{cantCreateReason}</p>
            ) : (
              <Button onClick={openNew} className="gap-2">
                <Plus className="h-4 w-4" /> Novo item
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, patrimônio, série, marca ou modelo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full lg:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {ITEM_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {serializedCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="Local" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os locais</SelectItem>
                  {activeLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cód. patrimonial</TableHead>
                    <TableHead>Nº série</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead className="text-center w-16">Specs</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={10}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum item encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((it) => {
                      const status = it.status as InventoryItemStatus;
                      const brandModel = [it.brand, it.model].filter(Boolean).join(' / ') || '—';
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">
                            <div>{it.name}</div>
                            {it.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                                {it.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{it.category?.name ?? 'Sem categoria'}</TableCell>
                          <TableCell>{it.location?.name ?? 'Sem local'}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(status)}>
                              {ITEM_STATUS_LABEL[status] ?? status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{it.asset_code || '—'}</TableCell>
                          <TableCell className="text-sm">{it.serial_number || '—'}</TableCell>
                          <TableCell className="text-sm">{brandModel}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {getTechnicalSpecs(it.metadata).length}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(it.updated_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(it)}
                                className="gap-1"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openStatus(it)}
                                className="gap-1"
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Status
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <InventoryItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} />
      <InventoryItemStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        item={statusItem}
      />
    </div>
  );
}
