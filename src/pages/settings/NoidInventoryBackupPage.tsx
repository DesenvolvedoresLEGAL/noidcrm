import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, Download, FileJson, FileSpreadsheet, RefreshCw, ShieldCheck, Info, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsGate } from '@/components/SettingsGate';

type Priority = 'essential' | 'support' | 'context';
type Status = 'pending' | 'loading' | 'found' | 'not_found' | 'empty' | 'forbidden' | 'error';

interface TargetTable {
  name: string;
  label: string;
  priority: Priority;
}

interface TableResult {
  table: TargetTable;
  status: Status;
  rows: Record<string, any>[];
  count: number;
  lastUpdatedAt: string | null;
  errorMessage?: string;
}

const TARGET_TABLES: TargetTable[] = [
  { name: 'product_inventory_requirements', priority: 'essential', label: 'Requisitos operacionais por produto' },
  { name: 'proposal_inventory_demand_snapshots', priority: 'essential', label: 'Snapshots de demanda operacional' },
  { name: 'products', priority: 'essential', label: 'Produtos comerciais' },
  { name: 'eventrix_inventory_integration_settings', priority: 'support', label: 'Configurações de integração Eventrix' },
  { name: 'eventrix_inventory_sync_cache', priority: 'support', label: 'Cache de sincronização Eventrix' },
  { name: 'proposals', priority: 'support', label: 'Propostas' },
  { name: 'proposal_items', priority: 'support', label: 'Itens de proposta' },
  { name: 'tenants', priority: 'context', label: 'Tenants' },
];

const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;

async function fetchAllRows(tableName: string): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let from = 0;
  while (from < MAX_ROWS) {
    const to = Math.min(from + PAGE_SIZE - 1, MAX_ROWS - 1);
    const { data, error } = await (supabase as any).from(tableName).select('*').range(from, to);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function classifyError(error: any): Status {
  const code = error?.code || error?.status;
  const msg = String(error?.message ?? '').toLowerCase();
  if (code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('not found')) {
    return 'not_found';
  }
  if (code === '42501' || code === '401' || code === '403' || msg.includes('permission') || msg.includes('rls')) {
    return 'forbidden';
  }
  return 'error';
}

function inferLastUpdatedAt(rows: Record<string, any>[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    const candidate = row?.updated_at ?? row?.created_at ?? null;
    if (candidate && typeof candidate === 'string') {
      if (!latest || candidate > latest) latest = candidate;
    }
  }
  return latest;
}

function convertToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const escape = (value: any) => {
    if (value === null || value === undefined) return '';
    const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    essential: { label: 'Essencial', variant: 'default' },
    support: { label: 'Apoio', variant: 'secondary' },
    context: { label: 'Contexto', variant: 'outline' },
  };
  const cfg = map[priority];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Aguardando', variant: 'outline' },
    loading: { label: 'Consultando…', variant: 'outline' },
    found: { label: 'Encontrada', variant: 'default' },
    empty: { label: 'Sem registros', variant: 'secondary' },
    not_found: { label: 'Não encontrada', variant: 'secondary' },
    forbidden: { label: 'Sem permissão', variant: 'destructive' },
    error: { label: 'Erro de leitura', variant: 'destructive' },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function NoidInventoryBackupInner() {
  const [results, setResults] = useState<Record<string, TableResult>>(() => {
    const initial: Record<string, TableResult> = {};
    for (const t of TARGET_TABLES) {
      initial[t.name] = { table: t, status: 'pending', rows: [], count: 0, lastUpdatedAt: null };
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    const next: Record<string, TableResult> = {};
    for (const t of TARGET_TABLES) {
      next[t.name] = { table: t, status: 'loading', rows: [], count: 0, lastUpdatedAt: null };
    }
    setResults({ ...next });

    await Promise.all(
      TARGET_TABLES.map(async (t) => {
        try {
          const rows = await fetchAllRows(t.name);
          next[t.name] = {
            table: t,
            status: rows.length === 0 ? 'empty' : 'found',
            rows,
            count: rows.length,
            lastUpdatedAt: inferLastUpdatedAt(rows),
          };
        } catch (err: any) {
          next[t.name] = {
            table: t,
            status: classifyError(err),
            rows: [],
            count: 0,
            lastUpdatedAt: null,
            errorMessage: err?.message ?? 'Erro desconhecido',
          };
        }
      })
    );
    setResults({ ...next });
    setLoading(false);
  }, []);

  useEffect(() => {
    runDiagnostic();
  }, [runDiagnostic]);

  const exportTableCsv = (name: string) => {
    const r = results[name];
    if (!r || r.rows.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }
    try {
      downloadTextFile(`noid-${name}-${todayIso()}.csv`, convertToCsv(r.rows), 'text/csv;charset=utf-8');
      toast.success('CSV exportado com sucesso.');
    } catch {
      toast.error('Não foi possível exportar esta tabela.');
    }
  };

  const exportTableJson = (name: string) => {
    const r = results[name];
    if (!r || r.rows.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }
    try {
      downloadTextFile(`noid-${name}-${todayIso()}.json`, JSON.stringify(r.rows, null, 2), 'application/json');
      toast.success('JSON exportado com sucesso.');
    } catch {
      toast.error('Não foi possível exportar esta tabela.');
    }
  };

  const buildFullBackup = () => {
    const tables: Record<string, any[]> = {};
    const summary: Record<string, number> = {};
    for (const t of TARGET_TABLES) {
      const r = results[t.name];
      tables[t.name] = r?.rows ?? [];
      summary[`${t.name}_count`] = r?.count ?? 0;
    }
    return {
      exported_at: new Date().toISOString(),
      source: 'NOID',
      purpose: 'inventory_backup_for_eventrix_migration',
      tables,
      summary,
      statuses: Object.fromEntries(
        Object.values(results).map((r) => [r.table.name, r.status])
      ),
    };
  };

  const exportFullJson = () => {
    try {
      const payload = buildFullBackup();
      downloadTextFile(
        `noid-inventory-full-backup-${todayIso()}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      toast.success('Backup completo exportado.');
    } catch {
      toast.error('Não foi possível exportar o backup completo.');
    }
  };

  const copySummary = async () => {
    const lines = TARGET_TABLES.map((t) => {
      const r = results[t.name];
      return `${t.name}: ${r?.status ?? 'pending'} (${r?.count ?? 0} registros)`;
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Resumo copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar o resumo.');
    }
  };

  const migrationSummary = useMemo(() => {
    const reqs = results['product_inventory_requirements']?.rows ?? [];
    const products = results['products']?.rows ?? [];
    const snapshots = results['proposal_inventory_demand_snapshots']?.rows ?? [];

    const productIdsWithReqs = new Set(reqs.map((r) => r.product_id).filter(Boolean));
    const productsWithoutReqs = products.filter((p) => !productIdsWithReqs.has(p.id)).length;

    const productIdsAll = new Set(products.map((p) => p.id));
    const reqsWithoutProduct = reqs.filter((r) => r.product_id && !productIdsAll.has(r.product_id)).length;

    const categories = new Set(reqs.map((r) => r.eventrix_category_id).filter(Boolean));
    const families = new Set(reqs.map((r) => r.eventrix_family_id).filter(Boolean));
    const kinds = new Set(reqs.map((r) => r.eventrix_item_kind).filter(Boolean));

    return {
      productsWithReqs: productIdsWithReqs.size,
      productsWithoutReqs,
      reqsWithoutProduct,
      categories: categories.size,
      families: families.size,
      kinds: kinds.size,
      snapshots: snapshots.length,
    };
  }, [results]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Backup Inventário NOID</h1>
            <p className="text-muted-foreground max-w-3xl">
              Exporte os dados de requisitos operacionais, snapshots e configurações de inventário do NOID
              para análise e futura migração assistida ao Eventrix.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Read-only</Badge>
            <Badge variant="outline">Sem sincronização</Badge>
            <Badge variant="outline">Sem alteração de dados</Badge>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Esta tela não migra dados para o Eventrix</AlertTitle>
          <AlertDescription>
            Ela apenas exporta informações do NOID para backup e análise. Nenhuma operação de escrita,
            sincronização ou integração é executada.
          </AlertDescription>
        </Alert>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runDiagnostic} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recarregar diagnóstico
        </Button>
        <Button onClick={exportFullJson} disabled={loading}>
          <Download className="h-4 w-4 mr-2" />
          Exportar backup completo JSON
        </Button>
        <Button onClick={copySummary} variant="ghost">
          <Copy className="h-4 w-4 mr-2" />
          Copiar resumo
        </Button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TARGET_TABLES.map((t) => {
          const r = results[t.name];
          const canExport = r?.status === 'found' && r.count > 0;
          return (
            <Card key={t.name}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-mono">{t.name}</CardTitle>
                    <CardDescription>{t.label}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r?.status ?? 'pending'} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div>Registros: <span className="font-medium text-foreground">{r?.count ?? 0}</span></div>
                  <div>
                    Última atualização:{' '}
                    <span className="font-medium text-foreground">
                      {r?.lastUpdatedAt ? new Date(r.lastUpdatedAt).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                  {r?.status === 'not_found' && (
                    <div className="mt-2 text-xs">Tabela não encontrada neste projeto.</div>
                  )}
                  {r?.status === 'forbidden' && (
                    <div className="mt-2 text-xs">
                      Sem permissão para ler esta tabela com o usuário atual. Verifique se o perfil é
                      owner/admin/operations.
                    </div>
                  )}
                  {r?.status === 'error' && r.errorMessage && (
                    <div className="mt-2 text-xs text-destructive break-all">{r.errorMessage}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!canExport} onClick={() => exportTableCsv(t.name)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canExport} onClick={() => exportTableJson(t.name)}>
                    <FileJson className="h-4 w-4 mr-2" /> Exportar JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Resumo para futura migração Eventrix</CardTitle>
          <CardDescription>
            Indicadores agregados a partir dos dados exportáveis do NOID.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">Produtos com requisitos</div><div className="text-2xl font-semibold">{migrationSummary.productsWithReqs}</div></div>
          <div><div className="text-muted-foreground">Produtos sem requisitos</div><div className="text-2xl font-semibold">{migrationSummary.productsWithoutReqs}</div></div>
          <div><div className="text-muted-foreground">Categorias referenciadas</div><div className="text-2xl font-semibold">{migrationSummary.categories}</div></div>
          <div><div className="text-muted-foreground">Famílias referenciadas</div><div className="text-2xl font-semibold">{migrationSummary.families}</div></div>
          <div><div className="text-muted-foreground">Tipos de item</div><div className="text-2xl font-semibold">{migrationSummary.kinds}</div></div>
          <div><div className="text-muted-foreground">Snapshots de demanda</div><div className="text-2xl font-semibold">{migrationSummary.snapshots}</div></div>
          <div><div className="text-muted-foreground">Requisitos sem produto</div><div className="text-2xl font-semibold">{migrationSummary.reqsWithoutProduct}</div></div>
        </CardContent>
      </Card>

      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção — interpretação dos dados</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Os dados do NOID representam requisitos comerciais/operacionais e snapshots de demanda.
            Eles não devem ser importados diretamente como itens físicos no Eventrix.
          </p>
          <p>
            O mapeamento correto é:{' '}
            <code className="font-mono text-xs">NOID product_inventory_requirements</code> → Eventrix
            Kits / Famílias / Regras de composição. Não importar como <code className="font-mono text-xs">inventory_items</code>{' '}
            físicos sem validação.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function NoidInventoryBackupPage() {
  return (
    <SettingsGate requiredLevel="full">
      <NoidInventoryBackupInner />
    </SettingsGate>
  );
}
