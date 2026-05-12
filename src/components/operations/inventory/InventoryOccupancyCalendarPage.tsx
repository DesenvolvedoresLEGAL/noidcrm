import { useMemo, useState } from 'react';
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CalendarRange } from 'lucide-react';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilies } from '@/hooks/operations/useInventoryFamilies';
import {
  useInventoryCapacityByPeriod,
  useInventoryOccupancyCalendar,
} from '@/hooks/operations/useInventoryOccupancy';
import {
  OCCUPANCY_BADGE_VARIANT,
  OCCUPANCY_TYPE_LABELS,
  RISK_LEVEL_BADGE,
  RISK_LEVEL_LABELS,
  type CapacityRow,
  type OccupancyRow,
} from '@/lib/operations/inventoryOccupancy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ViewMode = 'month' | 'item' | 'category' | 'reservation';

function formatPercent(rate: number) {
  return `${Math.round((rate ?? 0) * 100)}%`;
}

export function InventoryOccupancyCalendarPage() {
  const today = new Date();
  const [start, setStart] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('month');

  const { data: categories = [] } = useInventoryCategories();
  const { data: families = [] } = useInventoryFamilies(categoryId ?? undefined);

  const filters = {
    start_date: start,
    end_date: end,
    category_id: categoryId,
    family_id: familyId,
    status: statusFilter,
    view_mode: (view === 'month' ? 'item' : view) as 'item' | 'category' | 'reservation',
  };

  const occupancy = useInventoryOccupancyCalendar(filters);
  const capacity = useInventoryCapacityByPeriod({
    start_date: start,
    end_date: end,
    category_id: categoryId,
    family_id: familyId,
  });

  const summary = useMemo(() => {
    const rows = capacity.data ?? [];
    const sum = (k: keyof CapacityRow) =>
      rows.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
    const total = sum('total_units');
    const occ =
      sum('pre_reserved_units') +
      sum('reserved_units') +
      sum('in_preparation_units') +
      sum('dispatched_units') +
      sum('in_operation_units') +
      sum('returned_units');
    const rate = total > 0 ? occ / total : 0;
    return {
      total,
      available: sum('available_units'),
      pre_reserved: sum('pre_reserved_units'),
      reserved: sum('reserved_units'),
      in_operation: sum('in_operation_units'),
      returned: sum('returned_units'),
      maintenance: sum('maintenance_units'),
      occupancy_rate: rate,
      risk:
        rate >= 0.9 ? 'critico' : rate >= 0.75 ? 'alto' : rate >= 0.5 ? 'medio' : 'baixo',
    };
  }, [capacity.data]);

  const alerts = useMemo(() => {
    const rows = capacity.data ?? [];
    const messages: { level: 'alto' | 'critico'; text: string }[] = [];
    rows.forEach((r) => {
      if (r.risk_level === 'alto' || r.risk_level === 'critico') {
        messages.push({
          level: r.risk_level as 'alto' | 'critico',
          text: `${r.category_name ?? 'Sem categoria'}${
            r.family_name ? ' / ' + r.family_name : ''
          } está com ${formatPercent(r.occupancy_rate)} de ocupação no período.`,
        });
      }
    });
    return messages;
  }, [capacity.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Início</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fim</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={categoryId ?? 'all'}
              onValueChange={(v) => {
                setCategoryId(v === 'all' ? null : v);
                setFamilyId(null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Família</Label>
            <Select
              value={familyId ?? 'all'}
              onValueChange={(v) => setFamilyId(v === 'all' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={statusFilter ?? 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(OCCUPANCY_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Capacidade total" value={summary.total} />
        <SummaryCard label="Livres" value={summary.available} />
        <SummaryCard label="Pré reservadas" value={summary.pre_reserved} />
        <SummaryCard label="Reservadas" value={summary.reserved} />
        <SummaryCard label="Em operação" value={summary.in_operation} />
        <SummaryCard label="Retornos" value={summary.returned} />
        <SummaryCard label="Manutenção" value={summary.maintenance} />
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Taxa de ocupação</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatPercent(summary.occupancy_rate)}
            </div>
            <Badge variant={RISK_LEVEL_BADGE[summary.risk]} className="mt-2">
              Risco {RISK_LEVEL_LABELS[summary.risk]}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alerts.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant={RISK_LEVEL_BADGE[a.level]}>
                  {RISK_LEVEL_LABELS[a.level]}
                </Badge>
                <span>{a.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="month">Calendário mensal</TabsTrigger>
          <TabsTrigger value="item">Por item</TabsTrigger>
          <TabsTrigger value="category">Por categoria</TabsTrigger>
          <TabsTrigger value="reservation">Por reserva</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <MonthlyOccupancyCalendar
            data={occupancy.data ?? []}
            isLoading={occupancy.isLoading}
            initialMonth={start}
            onChangeMonth={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </TabsContent>
        <TabsContent value="item">
          <OccupancyByItemTable
            data={occupancy.data ?? []}
            isLoading={occupancy.isLoading}
            start={start}
            end={end}
          />
        </TabsContent>
        <TabsContent value="category">
          <CapacityByCategoryTable data={capacity.data ?? []} isLoading={capacity.isLoading} />
        </TabsContent>
        <TabsContent value="reservation">
          <OccupancyByReservationTable data={occupancy.data ?? []} isLoading={occupancy.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{Number(value).toLocaleString('pt-BR')}</div>
      </CardContent>
    </Card>
  );
}

function OccupancyByItemTable({
  data,
  isLoading,
  start,
  end,
}: {
  data: OccupancyRow[];
  isLoading: boolean;
  start: string;
  end: string;
}) {
  const days = useMemo(() => {
    const out: string[] = [];
    const s = new Date(start);
    const e = new Date(end);
    let cur = s;
    while (cur <= e && out.length < 31) {
      out.push(format(cur, 'yyyy-MM-dd'));
      cur = addDays(cur, 1);
    }
    return out;
  }, [start, end]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; code: string | null; rows: OccupancyRow[] }>();
    data.forEach((r) => {
      const key = r.item_id ?? `${r.item_name}-${r.source_type}`;
      if (!map.has(key)) {
        map.set(key, {
          name: r.item_name ?? '—',
          code: r.item_code ?? null,
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    });
    return Array.from(map.entries());
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!grouped.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma ocupação no período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 p-2 text-left">Item</th>
              {days.map((d) => (
                <th key={d} className="p-2 text-center font-medium">
                  {format(new Date(d), 'dd/MM')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([key, group]) => (
              <tr key={key} className="border-t">
                <td className="sticky left-0 z-10 bg-background p-2">
                  <div className="font-medium">{group.name}</div>
                  {group.code && (
                    <div className="text-xs text-muted-foreground">{group.code}</div>
                  )}
                </td>
                {days.map((d) => {
                  const cell = group.rows.find(
                    (r) => d >= r.start_date && d <= r.end_date,
                  );
                  return (
                    <td key={d} className="p-1 text-center align-middle">
                      {cell ? (
                        <Badge
                          variant={OCCUPANCY_BADGE_VARIANT[cell.occupancy_type] ?? 'outline'}
                          className="text-[10px]"
                        >
                          {OCCUPANCY_TYPE_LABELS[cell.occupancy_type] ?? cell.occupancy_type}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CapacityByCategoryTable({
  data,
  isLoading,
}: {
  data: CapacityRow[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sem dados de capacidade.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Categoria</th>
              <th className="p-2 text-left">Família</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-right">Livre</th>
              <th className="p-2 text-right">Pré reservado</th>
              <th className="p-2 text-right">Reservado</th>
              <th className="p-2 text-right">Em operação</th>
              <th className="p-2 text-right">Manut.</th>
              <th className="p-2 text-right">Ocup.</th>
              <th className="p-2 text-center">Risco</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.category_name ?? '—'}</td>
                <td className="p-2">{r.family_name ?? '—'}</td>
                <td className="p-2 text-right">{r.total_units}</td>
                <td className="p-2 text-right">{r.available_units}</td>
                <td className="p-2 text-right">{r.pre_reserved_units}</td>
                <td className="p-2 text-right">
                  {r.reserved_units +
                    r.in_preparation_units +
                    r.dispatched_units +
                    r.returned_units}
                </td>
                <td className="p-2 text-right">{r.in_operation_units}</td>
                <td className="p-2 text-right">{r.maintenance_units}</td>
                <td className="p-2 text-right">{formatPercent(r.occupancy_rate)}</td>
                <td className="p-2 text-center">
                  <Badge variant={RISK_LEVEL_BADGE[r.risk_level] ?? 'outline'}>
                    {RISK_LEVEL_LABELS[r.risk_level] ?? r.risk_level}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function OccupancyByReservationTable({
  data,
  isLoading,
}: {
  data: OccupancyRow[];
  isLoading: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        source_id: string;
        source_type: string;
        reservation_code: string | null;
        client: string | null;
        start: string;
        end: string;
        status: string | null;
        risk: string | null;
        items: number;
      }
    >();
    data
      .filter((r) => r.source_type === 'pre_reservation' || r.source_type === 'reservation')
      .forEach((r) => {
        const k = `${r.source_type}-${r.source_id}`;
        if (!map.has(k)) {
          map.set(k, {
            source_id: r.source_id ?? '',
            source_type: r.source_type,
            reservation_code: r.reservation_code,
            client: r.client_name,
            start: r.start_date,
            end: r.end_date,
            status: r.status,
            risk: r.risk_level,
            items: 0,
          });
        }
        map.get(k)!.items += 1;
      });
    return Array.from(map.values());
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!grouped.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sem reservas no período.
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Período</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Itens</th>
              <th className="p-2 text-center">Risco</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 font-medium">{r.reservation_code ?? '—'}</td>
                <td className="p-2">{r.client ?? '—'}</td>
                <td className="p-2">
                  {r.source_type === 'pre_reservation' ? 'Pré reserva' : 'Reserva'}
                </td>
                <td className="p-2">
                  {format(new Date(r.start), 'dd/MM')} → {format(new Date(r.end), 'dd/MM')}
                </td>
                <td className="p-2">{r.status ?? '—'}</td>
                <td className="p-2 text-right">{r.items}</td>
                <td className="p-2 text-center">
                  <Badge variant={RISK_LEVEL_BADGE[r.risk ?? 'baixo'] ?? 'outline'}>
                    {RISK_LEVEL_LABELS[r.risk ?? 'baixo'] ?? r.risk ?? '—'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
