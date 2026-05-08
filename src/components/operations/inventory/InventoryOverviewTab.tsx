import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FolderTree,
  MapPin,
  PackageMinus,
  PackageOpen,
  PackageSearch,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import {
  ITEM_KIND_LABEL,
  ITEM_STATUS_LABEL,
  getStatusBadgeVariant,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';
import { useInventoryOverview } from '@/hooks/operations/useInventoryOverview';
import { useInventoryPreReservationsOverview } from '@/hooks/operations/useInventoryPreReservations';
import type { OverviewItemRow } from '@/services/operations/inventoryOverview';

interface Props {
  onNavigateToItems?: () => void;
}

const demandRules = [
  { range: 'Menor que 50%', factor: '0%' },
  { range: 'De 50% a 75%', factor: '+10% no valor da solução' },
  { range: 'De 76% a 90%', factor: '+20% no valor da solução' },
  { range: 'Acima de 90%', factor: '+30% no valor da solução' },
];

const futureCapabilities = [
  'Chips com dados próprios',
  'Associação entre roteadores e chips',
  'Kits operacionais',
  'Reservas por período',
  'Disponibilidade dentro da proposta',
  'Ocupação de estoque na tabela dinâmica',
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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
  tone = 'default',
}: {
  title: string;
  value: number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  tone?: 'default' | 'warn' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'success'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-3xl font-semibold ${toneClass}`}>{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniKpi({
  title,
  value,
  loading,
  icon: Icon,
}: {
  title: string;
  value: number;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {loading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-semibold">{value}</div>}
      </CardContent>
    </Card>
  );
}

function getCriticalBadge(it: OverviewItemRow): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (it.item_kind === 'quantity') {
    const a = Number(it.quantity_available ?? 0);
    if (a === 0) return { label: 'Zerado', variant: 'destructive' };
    if (
      it.quantity_minimum !== null &&
      it.quantity_minimum !== undefined &&
      a < Number(it.quantity_minimum)
    ) {
      return { label: 'Abaixo do mínimo', variant: 'destructive' };
    }
  }
  return {
    label: ITEM_STATUS_LABEL[it.status as InventoryItemStatus] ?? it.status,
    variant: getStatusBadgeVariant(it.status as InventoryItemStatus),
  };
}

function balance(it: OverviewItemRow) {
  if (it.item_kind === 'serialized') return '—';
  return `${Number(it.quantity_available ?? 0)} / ${Number(it.quantity_total ?? 0)}`;
}

export function InventoryOverviewTab({ onNavigateToItems }: Props = {}) {
  const ov = useInventoryOverview();
  const preRes = useInventoryPreReservationsOverview();
  const noItems = !ov.isLoading && ov.aggregates.totalItems === 0;
  const { totals, health, alerts } = ov.aggregates;
  const noAlerts =
    !ov.isLoading &&
    alerts.below === 0 &&
    alerts.zeroed === 0 &&
    alerts.maintenance === 0 &&
    alerts.damagedOrLost === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Acompanhe a saúde operacional dos ativos, saldos, locais e categorias do inventário.
      </p>

      {noItems && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="rounded-full bg-muted p-4">
              <Boxes className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Inventário ainda sem itens cadastrados</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                Cadastre itens serializados ou por quantidade para começar a acompanhar a saúde
                operacional do estoque.
              </p>
            </div>
            {onNavigateToItems && (
              <Button onClick={onNavigateToItems} className="mt-2">Cadastrar item</Button>
            )}
          </CardContent>
        </Card>
      )}

      <InventoryOperationalCapacityBlock />

      {/* Bloco 1 — KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Itens serializados"
          value={totals.serialized}
          description="Ativos físicos únicos cadastrados."
          icon={PackageSearch}
          loading={ov.isLoading}
        />
        <KpiCard
          title="Itens por quantidade"
          value={totals.quantity}
          description="Itens controlados por saldo."
          icon={PackageOpen}
          loading={ov.isLoading}
        />
        <KpiCard
          title="Disponíveis"
          value={totals.available}
          description="Itens aptos para uso operacional."
          icon={CheckCircle2}
          loading={ov.isLoading}
          tone="success"
        />
        <KpiCard
          title="Indisponíveis"
          value={totals.unavailable}
          description="Itens fora da disponibilidade operacional."
          icon={PackageMinus}
          loading={ov.isLoading}
          tone="warn"
        />
      </div>

      {/* Bloco 2 — Saúde operacional */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Saúde operacional
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <MiniKpi title="Bloqueados" value={health.blocked} loading={ov.isLoading} icon={PackageMinus} />
          <MiniKpi title="Em manutenção" value={health.maintenance} loading={ov.isLoading} icon={Wrench} />
          <MiniKpi title="Danificados" value={health.damaged} loading={ov.isLoading} icon={AlertTriangle} />
          <MiniKpi title="Perdidos" value={health.lost} loading={ov.isLoading} icon={AlertTriangle} />
          <MiniKpi title="Baixados" value={health.retired} loading={ov.isLoading} icon={PackageMinus} />
          <MiniKpi title="Categorias" value={ov.categoriesCount} loading={ov.isLoading} icon={FolderTree} />
          <MiniKpi title="Locais" value={ov.locationsCount} loading={ov.isLoading} icon={MapPin} />
        </div>
      </div>

      {/* Bloco — Inventário por categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventário por categoria</CardTitle>
          <CardDescription>
            Visão consolidada de SKUs, unidades e itens críticos agrupados por categoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ov.categoryOverviewLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : ov.categoryOverview.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Sem categorias com itens"
              description="Cadastre categorias e classifique itens para acompanhar o inventário por categoria."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">SKUs</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Disponíveis</TableHead>
                    <TableHead className="text-right">Em manutenção</TableHead>
                    <TableHead className="text-right">Itens críticos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ov.categoryOverview.map((c) => (
                    <TableRow key={c.category_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {c.category_color && (
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-border/40"
                              style={{ backgroundColor: c.category_color }}
                            />
                          )}
                          {c.category_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.total_skus}</TableCell>
                      <TableCell className="text-right text-sm">{c.total_units}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400">
                        {c.available_units}
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.maintenance_units}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.critical_items > 0 ? 'destructive' : 'outline'}>
                          {c.critical_items}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco — Pré reservas operacionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pré reservas operacionais</CardTitle>
          <CardDescription>
            Reservas comerciais por período. Não alteram o status físico dos itens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MiniKpi
              title="Ativas"
              value={Number(preRes.data?.active_pre_reservations ?? 0)}
              loading={preRes.isLoading}
              icon={PackageSearch}
            />
            <MiniKpi
              title="Itens"
              value={Number(preRes.data?.pre_reserved_items ?? 0)}
              loading={preRes.isLoading}
              icon={PackageOpen}
            />
            <MiniKpi
              title="Conflitos"
              value={Number(preRes.data?.availability_conflicts ?? 0)}
              loading={preRes.isLoading}
              icon={AlertTriangle}
            />
            <MiniKpi
              title="Críticas"
              value={Number(preRes.data?.critical_risk_reservations ?? 0)}
              loading={preRes.isLoading}
              icon={PackageMinus}
            />
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Próxima op.</p>
                    <p className="text-lg font-semibold">
                      {preRes.isLoading
                        ? '...'
                        : preRes.data?.next_operational_start
                          ? format(
                              new Date(preRes.data.next_operational_start + 'T00:00:00'),
                              'dd/MM',
                              { locale: ptBR },
                            )
                          : '—'}
                    </p>
                  </div>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Alertas operacionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas operacionais</CardTitle>
          <CardDescription>
            Itens que exigem atenção do time antes de novas vendas, separações ou operações em campo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {noAlerts ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <h4 className="font-semibold">Nenhum alerta operacional no momento</h4>
              <p className="text-sm text-muted-foreground max-w-md">
                Não há itens zerados, abaixo do mínimo, danificados, perdidos ou em manutenção.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AlertCard
                title="Abaixo do mínimo"
                value={alerts.below}
                description="Itens por quantidade com saldo abaixo do estoque mínimo."
                loading={ov.isLoading}
              />
              <AlertCard
                title="Zerados"
                value={alerts.zeroed}
                description="Itens por quantidade sem saldo disponível."
                loading={ov.isLoading}
              />
              <AlertCard
                title="Em manutenção"
                value={alerts.maintenance}
                description="Itens aguardando revisão ou reparo."
                loading={ov.isLoading}
              />
              <AlertCard
                title="Danificados ou perdidos"
                value={alerts.damagedOrLost}
                description="Itens com risco de perda operacional ou patrimonial."
                loading={ov.isLoading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 4 — Itens críticos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens que exigem atenção</CardTitle>
          <CardDescription>Top 10 priorizados por gravidade do alerta.</CardDescription>
        </CardHeader>
        <CardContent>
          {ov.criticalLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : ov.criticalItems.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sem itens críticos"
              description="Nenhum item zerado, abaixo do mínimo, em manutenção, danificado ou perdido."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Status / Alerta</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ov.criticalItems.map((it) => {
                    const b = getCriticalBadge(it);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {ITEM_KIND_LABEL[it.item_kind] ?? it.item_kind}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {it.category?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {it.location?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </TableCell>
                        <TableCell>{balance(it)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(it.updated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 5 + 6 lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos itens atualizados</CardTitle>
          </CardHeader>
          <CardContent>
            {ov.recentItemsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : ov.recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum item cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ov.recentItems.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {ITEM_KIND_LABEL[it.item_kind] ?? it.item_kind}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(it.status as InventoryItemStatus)}>
                          {ITEM_STATUS_LABEL[it.status as InventoryItemStatus] ?? it.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(it.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas mudanças de status</CardTitle>
          </CardHeader>
          <CardContent>
            {ov.recentHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : ov.recentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma mudança de status registrada ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ov.recentHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.item?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {h.from_status ? ITEM_STATUS_LABEL[h.from_status] ?? h.from_status : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(h.to_status)}>
                          {ITEM_STATUS_LABEL[h.to_status] ?? h.to_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[180px] truncate">
                        {h.reason?.trim() ? h.reason : 'Sem motivo informado'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(h.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloco 7 — Regra de demanda (enxuta) */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="text-base">Regra oficial de demanda por ocupação</CardTitle>
          <CardDescription>
            A tabela dinâmica usará a ocupação do estoque como fator de preço, desconto e aprovação
            em sprint futura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Ocupação do estoque</th>
                  <th className="text-left font-semibold px-4 py-2">Fator aplicado</th>
                </tr>
              </thead>
              <tbody>
                {demandRules.map((rule, idx) => (
                  <tr key={rule.range} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-4 py-2">{rule.range}</td>
                    <td className="px-4 py-2 text-foreground/90">{rule.factor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            O cálculo será feito por produto, categoria e período operacional. Esta sprint ainda não
            implementa ocupação por período.
          </p>
        </CardContent>
      </Card>

      {/* Bloco 8 — Próximas capacidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas capacidades do Inventário</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 list-decimal list-inside text-sm text-foreground/90">
            {futureCapabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertCard({
  title,
  value,
  description,
  loading,
}: {
  title: string;
  value: number;
  description: string;
  loading?: boolean;
}) {
  const tone = value > 0 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <AlertTriangle className={`h-3.5 w-3.5 ${value > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1 leading-snug">{description}</p>
      </CardContent>
    </Card>
  );
}
