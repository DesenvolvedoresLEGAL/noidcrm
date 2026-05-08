import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Layers, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  STOCK_ALERT_LABEL,
  getStatusBadgeVariant,
  getStockAlert,
  getStockAlertVariant,
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
import { useInventoryQuantityItems } from '@/hooks/operations/useInventoryItems';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilies } from '@/hooks/operations/useInventoryFamilies';
import { useInventoryLocations } from '@/hooks/operations/useInventoryLocations';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';
import { InventoryQuantityItemFormDialog } from './InventoryQuantityItemFormDialog';
import { InventoryQuantityItemStatusDialog } from './InventoryQuantityItemStatusDialog';
import { getTechnicalSpecs } from '@/lib/operations/inventoryTechnicalSpecs';

function fmtNum(v: any) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function InventoryQuantityItemsTab() {
  const { data: items, isLoading } = useInventoryQuantityItems();
  const { data: categories } = useInventoryCategories();
  const { data: locations } = useInventoryLocations();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InventoryItemStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [opTypeFilter, setOpTypeFilter] = useState<'all' | OperationalType>('all');
  const [critFilter, setCritFilter] = useState<'all' | Criticality>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const { data: families } = useInventoryFamilies(
    categoryFilter !== 'all' ? categoryFilter : undefined,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemWithRefs | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusItem, setStatusItem] = useState<InventoryItemWithRefs | null>(null);

  const quantityCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active && c.item_kind === 'quantity'),
    [categories],
  );
  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.is_active),
    [locations],
  );
  const activeFamilies = useMemo(
    () => (families ?? []).filter((f) => f.is_active),
    [families],
  );

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (categoryFilter !== 'all') list = list.filter((i) => i.category_id === categoryFilter);
    if (familyFilter !== 'all') list = list.filter((i) => (i as any).family_id === familyFilter);
    if (opTypeFilter !== 'all') list = list.filter((i) => (i as any).operational_type === opTypeFilter);
    if (critFilter !== 'all') list = list.filter((i) => (i as any).criticality === critFilter);
    if (locationFilter !== 'all') list = list.filter((i) => i.location_id === locationFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        [i.name, i.description, i.brand, i.model]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [items, search, statusFilter, categoryFilter, familyFilter, opTypeFilter, critFilter, locationFilter]);

  const cards = useMemo(() => {
    const list = items ?? [];
    const total = list.length;
    const available = list.filter((i) => i.status === 'available').length;
    const below = list.filter(
      (i) =>
        i.quantity_minimum !== null &&
        i.quantity_minimum !== undefined &&
        Number(i.quantity_available) < Number(i.quantity_minimum),
    ).length;
    const zeroed = list.filter((i) => Number(i.quantity_available) === 0).length;
    return { total, available, below, zeroed };
  }, [items]);

  const isEmpty = !isLoading && (items?.length ?? 0) === 0;
  const noCategories = quantityCategories.length === 0;
  const noLocations = activeLocations.length === 0;
  const cantCreate = noCategories || noLocations;
  const cantCreateReason = noCategories
    ? 'Cadastre uma categoria por quantidade antes de criar itens deste tipo.'
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
      <Plus className="h-4 w-4" /> Novo item por quantidade
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Itens por quantidade</h3>
          <p className="text-sm text-muted-foreground">
            Itens controlados por saldo, como cabos, patch cords, adaptadores, abraçadeiras e materiais de instalação.
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: 'Itens por quantidade', value: cards.total },
          { title: 'Disponíveis', value: cards.available },
          { title: 'Abaixo do mínimo', value: cards.below },
          { title: 'Zerados', value: cards.zeroed },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          <EmptyState
            icon={Layers}
            title="Nenhum item por quantidade cadastrado"
            description="Cadastre itens controlados por saldo, como cabos, patch cords, adaptadores, abraçadeiras e materiais de instalação."
          />
          <div className="flex justify-center">
            {cantCreate ? (
              <p className="text-sm text-muted-foreground">{cantCreateReason}</p>
            ) : (
              <Button onClick={openNew} className="gap-2">
                <Plus className="h-4 w-4" /> Novo item por quantidade
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
                  placeholder="Buscar por nome, descrição, marca ou modelo..."
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
                  {quantityCategories.map((c) => (
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

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Qtd. total</TableHead>
                    <TableHead className="text-right">Qtd. disponível</TableHead>
                    <TableHead className="text-right">Estoque mín.</TableHead>
                    <TableHead>Alerta</TableHead>
                    <TableHead className="text-center w-16">Specs</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={12}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        Nenhum item encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((it) => {
                      const status = it.status as InventoryItemStatus;
                      const alert = getStockAlert({
                        available: Number(it.quantity_available),
                        minimum:
                          it.quantity_minimum === null || it.quantity_minimum === undefined
                            ? null
                            : Number(it.quantity_minimum),
                      });
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
                          <TableCell className="text-sm">{it.unit_of_measure || '—'}</TableCell>
                          <TableCell className="text-right text-sm">{fmtNum(it.quantity_total)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtNum(it.quantity_available)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtNum(it.quantity_minimum)}</TableCell>
                          <TableCell>
                            <Badge variant={getStockAlertVariant(alert)}>
                              {STOCK_ALERT_LABEL[alert]}
                            </Badge>
                          </TableCell>
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

      <InventoryQuantityItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} />
      <InventoryQuantityItemStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        item={statusItem}
      />
    </div>
  );
}
