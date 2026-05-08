import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Eye,
  MoreHorizontal,
  PackageCheck,
  PackageOpen,
  PackageX,
  Search,
  Truck,
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
  RESERVATION_RISK_LABELS,
  RESERVATION_RISK_LEVELS,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_SOURCES,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUSES,
  reservationRiskBadgeVariant,
  reservationStatusBadgeVariant,
  type ReservationRiskLevel,
  type ReservationSource,
  type ReservationStatus,
} from '@/lib/operations/inventoryReservations';
import {
  useCancelInventoryReservation,
  useInventoryReservations,
  useInventoryReservationsOverview,
} from '@/hooks/operations/useInventoryReservations';
import { InventoryReservationDetailDialog } from './InventoryReservationDetailDialog';

function fmt(v?: string | null) {
  if (!v) return '—';
  try {
    return format(new Date(v + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function InventoryDefinitiveReservationsTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ReservationStatus | 'all'>('all');
  const [risk, setRisk] = useState<ReservationRiskLevel | 'all'>('all');
  const [source, setSource] = useState<ReservationSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useInventoryReservations({ status, risk, source, search });
  const overview = useInventoryReservationsOverview();
  const cancel = useCancelInventoryReservation();

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancelar esta reserva definitiva?')) return;
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Reserva cancelada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const ov = overview.data;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Ativas"
          value={ov?.active_reservations ?? 0}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={<PackageCheck className="h-4 w-4" />}
          label="Itens reservados"
          value={ov?.reserved_items ?? 0}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={<PackageOpen className="h-4 w-4" />}
          label="Em preparação"
          value={ov?.reservations_in_preparation ?? 0}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={<Truck className="h-4 w-4" />}
          label="Despachadas"
          value={ov?.reservations_dispatched ?? 0}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={<PackageX className="h-4 w-4" />}
          label="Em operação"
          value={ov?.reservations_in_operation ?? 0}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4" />}
          label="Próxima operação"
          value={ov?.next_operational_start ? fmt(ov.next_operational_start) : '—'}
          loading={overview.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reservas definitivas</CardTitle>
          <CardDescription>
            Itens comprometidos para operação. Bloqueiam disponibilidade no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou título…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {RESERVATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESERVATION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={risk} onValueChange={(v) => setRisk(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os riscos</SelectItem>
                {RESERVATION_RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RESERVATION_RISK_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {RESERVATION_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESERVATION_SOURCE_LABELS[s]}
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
          ) : (list.data ?? []).length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="Nenhuma reserva definitiva"
              description="Converta uma pré reserva ativa para criar a primeira reserva definitiva."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.reservation_code}
                      </TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="text-xs">
                        {fmt(r.operational_start_date)} → {fmt(r.operational_end_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={reservationStatusBadgeVariant(r.status)}>
                          {RESERVATION_STATUS_LABELS[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={reservationRiskBadgeVariant(r.risk_level)}>
                          {RESERVATION_RISK_LABELS[r.risk_level]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {RESERVATION_SOURCE_LABELS[r.source]}
                      </TableCell>
                      <TableCell className="text-right">{r.items_count}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(r.id)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                            </DropdownMenuItem>
                            {(r.status === 'confirmed' || r.status === 'in_preparation') && (
                              <DropdownMenuItem onClick={() => handleCancel(r.id)}>
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

      <InventoryReservationDetailDialog
        id={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon} {label}
        </div>
        {loading ? (
          <Skeleton className="h-6 w-16 mt-1" />
        ) : (
          <p className="text-xl font-semibold mt-1">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
