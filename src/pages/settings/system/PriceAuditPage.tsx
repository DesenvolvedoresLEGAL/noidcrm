// PRICE AUDIT MAY 2026 — Página admin para auditoria financeira de propostas.
// Slack e ERP são EVIDÊNCIA. Apenas approval_snapshot/approved_amount/payment_schedule/ledger
// podem ser aplicados em modo safe.
import { useMemo, useState } from 'react';
import { Loader2, Play, Eye, CheckCircle2, AlertTriangle, EyeOff, ShieldQuestion } from 'lucide-react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { SettingsGate } from '@/components/SettingsGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatLedgerBRL } from '@/lib/proposals/pricingLedger';
import {
  useAuditRuns, useAuditItems, useAuditItem,
  useRunAudit, useApplyAuditItem, useIgnoreAuditItem, useMarkAuditItemReview,
} from '@/hooks/proposals/useProposalFinancialAudit';
import type { AuditItem } from '@/services/proposals/proposalFinancialAuditService';

const SOURCE_LABEL: Record<string, string> = {
  approval_snapshot: 'Approval snapshot',
  approved_amount: 'Approved amount',
  approved_payment_schedule: 'Payment schedule',
  pricing_breakdown_snapshot: 'Ledger',
  payment_intent: 'Payment intent (evidência)',
  erp_payload: 'ERP (evidência)',
  manual_review: 'Revisão manual',
};

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  divergent: { label: 'Divergente', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  needs_review: { label: 'Revisão manual', cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  fixed: { label: 'Corrigida', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  ignored: { label: 'Ignorada', cls: 'bg-muted text-muted-foreground' },
};

function ValueRow({ label, value, hint }: { label: string; value: number | null | undefined; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="font-mono text-sm">{formatLedgerBRL(value ?? null)}</div>
    </div>
  );
}

function PriceAuditContent() {
  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState('2026-05-01');
  const [periodEnd, setPeriodEnd] = useState('2026-05-31');
  const [dryRun, setDryRun] = useState(true);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const runs = useAuditRuns();
  const items = useAuditItems(
    {
      runId: selectedRunId ?? undefined,
      status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
      search: search || undefined,
    },
    !!selectedRunId,
  );
  const item = useAuditItem(openItemId);
  const runMut = useRunAudit();
  const applyMut = useApplyAuditItem();
  const ignoreMut = useIgnoreAuditItem();
  const reviewMut = useMarkAuditItemReview();

  const activeRun = useMemo(
    () => runs.data?.find((r) => r.id === selectedRunId) ?? runs.data?.[0],
    [runs.data, selectedRunId],
  );

  if (selectedRunId == null && runs.data && runs.data[0]) {
    // auto-select latest
    setTimeout(() => setSelectedRunId(runs.data![0].id), 0);
  }

  const kpis = useMemo(() => {
    const list = items.data ?? [];
    return {
      total: activeRun?.total_proposals ?? list.length,
      ok: activeRun?.ok_count ?? list.filter((i) => i.audit_status === 'ok').length,
      divergent: activeRun?.divergent_count ?? list.filter((i) => i.audit_status === 'divergent').length,
      review: activeRun?.needs_review_count ?? list.filter((i) => i.audit_status === 'needs_review').length,
      totalDelta: activeRun?.total_detected_delta ?? list.reduce((a, b) => a + (b.max_delta ?? 0), 0),
      affectedSellers: new Set(list.filter((i) => i.audit_status !== 'ok').map((i) => i.seller_name)).size,
    };
  }, [items.data, activeRun]);

  async function handleRun() {
    try {
      const res = await runMut.mutateAsync({ periodStart, periodEnd, dryRun });
      toast.success(
        `Auditoria concluída: ${res.total_proposals} propostas, ${res.divergent_count} divergentes, ${res.needs_review_count} para revisão.`,
      );
      setSelectedRunId(res.audit_run_id);
      setRunDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao executar auditoria');
    }
  }

  async function handleApply(id: string) {
    try {
      const r = await applyMut.mutateAsync({ id, mode: 'safe' });
      if (r?.status === 'needs_review') {
        toast.warning('Item marcado para revisão manual (fonte canônica é evidência).');
      } else {
        toast.success('Correção aplicada.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao aplicar');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header / Run */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Execuções de auditoria</h2>
          <p className="text-sm text-muted-foreground">
            Dry-run por padrão. Pix, provider, banco e ERP real estão fora de escopo.
          </p>
        </div>
        <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
          <DialogTrigger asChild>
            <Button><Play className="mr-2 h-4 w-4" />Rodar auditoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rodar auditoria financeira</DialogTitle>
              <DialogDescription>
                Compara Slack, deal, header, itens, condição comercial, cronograma, payment intent e ERP.
                Slack e ERP são apenas evidência.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={periodStart} max={today} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={periodEnd} max={today} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Dry-run</div>
                  <div className="text-xs text-muted-foreground">
                    Não altera propostas. Recomendado na primeira execução.
                  </div>
                </div>
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRunDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleRun} disabled={runMut.isPending}>
                {runMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Executar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Run selector */}
      {runs.data && runs.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-xs">Execução:</Label>
          <Select value={selectedRunId ?? ''} onValueChange={(v) => setSelectedRunId(v)}>
            <SelectTrigger className="w-[420px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {runs.data.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleString('pt-BR')} · {r.period_start} → {r.period_end}
                  {r.dry_run ? ' · dry-run' : ' · APPLY'} · {r.total_proposals} props
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeRun?.dry_run && <Badge variant="outline">Dry-run</Badge>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          { label: 'Total auditado', value: kpis.total },
          { label: 'OK', value: kpis.ok },
          { label: 'Com divergência', value: kpis.divergent },
          { label: 'Revisão manual', value: kpis.review },
          { label: 'Delta total', value: formatLedgerBRL(kpis.totalDelta) },
          { label: 'Vendedores afetados', value: kpis.affectedSellers },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{k.label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{k.value}</CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar proposta ou cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[280px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="divergent">Divergentes</SelectItem>
            <SelectItem value="needs_review">Revisão manual</SelectItem>
            <SelectItem value="fixed">Corrigidas</SelectItem>
            <SelectItem value="ignored">Ignoradas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {items.isLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !items.data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {selectedRunId ? 'Nenhum item para os filtros atuais.' : 'Rode uma auditoria para começar.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Aprovado</TableHead>
                  <TableHead className="text-right">Deal</TableHead>
                  <TableHead className="text-right">Ledger</TableHead>
                  <TableHead className="text-right">ERP</TableHead>
                  <TableHead className="text-right">Slack</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.data.map((it) => {
                  const sv = STATUS_VARIANT[it.audit_status] ?? STATUS_VARIANT.ok;
                  const canApplySafe = it.recommended_action === 'apply_safe' && it.audit_status !== 'fixed' && it.audit_status !== 'ignored';
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.proposal_number ?? '—'}</TableCell>
                      <TableCell>{it.account_name ?? '—'}</TableCell>
                      <TableCell>{it.seller_name ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.approved_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.deal_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.ledger_effective_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.erp_sent_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.slack_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatLedgerBRL(it.max_delta)}</TableCell>
                      <TableCell className="text-xs">{it.canonical_source ? SOURCE_LABEL[it.canonical_source] : '—'}</TableCell>
                      <TableCell><Badge className={sv.cls} variant="secondary">{sv.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setOpenItemId(it.id)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canApplySafe || applyMut.isPending}
                            onClick={() => handleApply(it.id)}
                            title={canApplySafe ? 'Aplicar correção segura' : 'Fonte canônica não é confiável para apply automático'}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reviewMut.mutate({ id: it.id })} title="Marcar revisão manual">
                            <ShieldQuestion className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => ignoreMut.mutate({ id: it.id })} title="Ignorar">
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Sheet open={!!openItemId} onOpenChange={(o) => !o && setOpenItemId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{item.data?.proposal_number ?? 'Detalhe da auditoria'}</SheetTitle>
            <SheetDescription>{item.data?.account_name} · {item.data?.seller_name}</SheetDescription>
          </SheetHeader>
          {item.data && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Fonte canônica recomendada: {item.data.canonical_source ? SOURCE_LABEL[item.data.canonical_source] : '—'}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Slack e ERP são tratados como evidência, nunca fonte contábil automática.
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Valores observados</h3>
                <div className="rounded-md border bg-card p-2">
                  <ValueRow label="Slack (evidência)" value={item.data.slack_amount} />
                  <ValueRow label="Deal (oportunidade)" value={item.data.deal_amount} />
                  <ValueRow label="Header / total_amount (legado)" value={item.data.proposal_total_amount} />
                  <ValueRow label="Ledger — efetivo" value={item.data.ledger_effective_amount} />
                  <ValueRow label="Ledger — ERP amount" value={item.data.ledger_erp_amount} />
                  <ValueRow label="Approved amount" value={item.data.approved_amount} />
                  <ValueRow label="Approval snapshot" value={item.data.approval_snapshot_amount} />
                  <ValueRow label="Cronograma de pagamento" value={item.data.payment_schedule_total} />
                  <ValueRow label="Payment intent (evidência)" value={item.data.payment_intent_expected_amount} />
                  <ValueRow label="ERP enviado (evidência)" value={item.data.erp_sent_amount} />
                  {item.data.reconstructed_ledger_amount != null && (
                    <ValueRow
                      label="Ledger reconstruído (diagnóstico)"
                      value={item.data.reconstructed_ledger_amount}
                      hint="Diagnóstico apenas — nunca usado como canonical automático."
                    />
                  )}
                  <div className="flex items-baseline justify-between pt-2 text-sm font-semibold">
                    <span>Δ máximo</span>
                    <span className="font-mono">{formatLedgerBRL(item.data.max_delta)}</span>
                  </div>
                </div>
              </div>

              {item.data.divergence_types.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Tipos de divergência</h3>
                  <div className="flex flex-wrap gap-1">
                    {item.data.divergence_types.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {(item.data.raw_values as any)?.before && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Antes / depois (apply)</h3>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(
                      {
                        before: (item.data.raw_values as any).before,
                        after: (item.data.raw_values as any).after,
                        applied_fields: (item.data.raw_values as any).applied_fields,
                      },
                      null, 2,
                    )}
                  </pre>
                </div>
              )}

              {(item.data.raw_values as any)?.raw_slack_payload && (
                <details className="rounded-md border p-2">
                  <summary className="cursor-pointer text-xs font-medium">Payload Slack bruto</summary>
                  <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify((item.data.raw_values as any).raw_slack_payload, null, 2)}</pre>
                </details>
              )}
              {(item.data.raw_values as any)?.raw_erp_payload && (
                <details className="rounded-md border p-2">
                  <summary className="cursor-pointer text-xs font-medium">Payload ERP bruto</summary>
                  <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify((item.data.raw_values as any).raw_erp_payload, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function PriceAuditPage() {
  return (
    <SettingsPageWrapper
      title="Auditoria Financeira de Propostas"
      description="Identifica divergências entre Slack, deal, header, itens, condição comercial, cronograma, ledger e ERP. Read-only por padrão (dry-run)."
    >
      <SettingsGate requiredLevel="full">
        <PriceAuditContent />
      </SettingsGate>
    </SettingsPageWrapper>
  );
}
