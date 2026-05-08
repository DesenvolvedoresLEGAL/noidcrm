import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Eye,
  MoreHorizontal,
  PackageMinus,
  PackageOpen,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  PRE_RESERVATION_RISK_LEVELS,
  PRE_RESERVATION_STATUSES,
  RISK_LABELS,
  STATUS_LABELS,
  riskBadgeVariant,
  statusBadgeVariant,
  type PreReservationRiskLevel,
  type PreReservationStatus,
} from '@/lib/operations/inventoryPreReservations';
import {
  useCancelInventoryPreReservation,
  useInventoryPreReservations,
  useInventoryPreReservationsOverview,
  useRecalculateInventoryPreReservation,
} from '@/hooks/operations/useInventoryPreReservations';
import { InventoryPreReservationDetailDialog } from './InventoryPreReservationDetailDialog';
import { InventoryPreReservationFormDialog } from './InventoryPreReservationFormDialog';

function fmtDate(v?: string | null) {
  if (!v) return '—';
  try {
    return format(new Date(v + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: any;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-semibold mt-1">{value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InventoryPreReservationsTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PreReservationStatus | 'all'>('all');
  const [risk, setRisk] = useState<PreReservationRiskLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const overview = useInventoryPreReservationsOverview();
  const list = useInventoryPreReservations({
    status,
    risk,
    search: search.trim() || undefined,
  });
  const recalc = useRecalculateInventoryPreReservation();
  const cancel = useCancelInventoryPreReservation();

  const handleRecalc = async (id: string) => {
    try {
      await recalc.mutateAsync(id);
      toast({ title: 'Disponibilidade recalculada' });
    } catch (e: any) {
      toast({ title: 'Erro ao recalcular', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancelar esta pré reserva?')) return;
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Pré reserva cancelada' });
    } catch (e: any) {
      toast({ title: 'Erro ao cancelar', description: e.message, variant: 'destructive' });
    }
  };

  const ov = overview.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Pré reservas ativas"
          value={ov?.active_pre_reservations ?? 0}
          description="Reservas comerciais segurando disponibilidade."
          icon={PackageSearch}
          loading={overview.isLoading}
        />
        <KpiCard
          title="Itens pré reservados"
          value={ov?.pre_reserved_items ?? 0}
          description="Linhas de item ativas em reservas."
          icon={PackageOpen}
          loading={overview.isLoading}
        />
        <KpiCard
          title="Conflitos"
          value={ov?.availability_conflicts ?? 0}
          description="Itens parcial ou indisponíveis no período."
          icon={AlertTriangle}
          loading={overview.isLoading}
        />
        <KpiCard
          title="Reservas críticas"
          value={ov?.critical_risk_reservations ?? 0}
          description="Reservas com risco alto ou crítico."
          icon={PackageMinus}
          loading={overview.isLoading}
        />
        <KpiCard
          title="Próxima operação"
          value={fmtDate(ov?.next_operational_start ?? null)}
          description="Próximo início operacional planejado."
          icon={CalendarRange}
          loading={overview.isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Pré reservas</CardTitle>
            <CardDescription>
              Reservas comerciais por período operacional. Não alteram o status físico do item.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova pré reserva
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou título"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {PRE_RESERVATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={risk} onValueChange={(v) => setRisk(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os riscos</SelectItem>
                {PRE_RESERVATION_RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RISK_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {list.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Nenhuma pré reserva encontrada"
              description="Crie pré reservas manualmente ou geradas a partir de propostas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Conflitos</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data?.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailId(r.id)}>
                      <TableCell className="font-mono text-xs">{r.reservation_code}</TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="text-sm">
                        {fmtDate(r.operational_start_date)} → {fmtDate(r.operational_end_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)}>{STATUS_LABELS[r.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={riskBadgeVariant(r.risk_level)}>{RISK_LABELS[r.risk_level]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.items_count}</TableCell>
                      <TableCell className="text-right">
                        {r.conflicts_count > 0 ? (
                          <Badge variant="destructive">{r.conflicts_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(r.id)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRecalc(r.id)}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Recalcular
                            </DropdownMenuItem>
                            {r.status === 'active' && (
                              <DropdownMenuItem
                                onClick={() => handleCancel(r.id)}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" /> Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InventoryPreReservationDetailDialog
        id={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
      <InventoryPreReservationFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
