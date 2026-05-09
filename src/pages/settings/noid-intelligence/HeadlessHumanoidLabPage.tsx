import { useMemo, useState, createContext, useContext } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  useHeadlessHumanoidHealth,
  useActionRegistry,
  useActionExecutions,
  useApprovalQueue,
  useDecideApproval,
  useUnifiedAudit,
  useRunSandboxTests,
  useTestRuns,
  useTestResults,
  SANDBOX_TESTS,
} from '@/hooks/useHeadlessHumanoidLab';
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  GitBranch,
  ListChecks,
  Eye,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Cross-tab navigation: lets cards/banners deep-link into other tabs with a preset filter
type LabNav = {
  setTab: (t: string) => void;
  registryPreset: 'risky_no_approval' | null;
  setRegistryPreset: (p: 'risky_no_approval' | null) => void;
  riskyKeys: string[];
};
const LabNavContext = createContext<LabNav | null>(null);
const useLabNav = () => useContext(LabNavContext)!;


function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-destructive/40'
      : tone === 'warning'
        ? 'border-amber-500/40'
        : tone === 'success'
          ? 'border-emerald-500/40'
          : '';
  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function GoNoGoBanner({
  status,
  blockers,
}: {
  status?: 'GO' | 'NO_GO';
  blockers?: { code: string; message: string; count: number }[];
}) {
  const isGo = status === 'GO';
  return (
    <Alert
      className={
        isGo
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-destructive/50 bg-destructive/5'
      }
    >
      {isGo ? (
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
      ) : (
        <ShieldAlert className="h-5 w-5 text-destructive" />
      )}
      <AlertTitle className="flex items-center gap-2">
        {isGo ? 'Agent-ready' : 'Bloqueado para superfícies externas'}
        <Badge variant={isGo ? 'default' : 'destructive'}>{status ?? '...'}</Badge>
      </AlertTitle>
      <AlertDescription>
        {isGo
          ? 'Camada Headless Humanoid validada. Esta organização está pronta para liberar novas superfícies controladas.'
          : 'Esta organização ainda não está pronta para Slack interativo, WhatsApp, MCP externo ou automações agentic. Corrija os blockers abaixo antes de liberar novas superfícies.'}
        {!isGo && blockers && blockers.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {blockers.map((b) => (
              <li key={b.code} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <span>
                  <span className="font-medium">{b.code}</span> · {b.message}{' '}
                  <Badge variant="outline" className="ml-1">
                    {b.count}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

function SnapshotTab() {
  const { data: health, isLoading } = useHeadlessHumanoidHealth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!health?.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar a saúde da stack</AlertTitle>
        <AlertDescription>{health?.error ?? 'erro desconhecido'}</AlertDescription>
      </Alert>
    );
  }

  const r = health.registry_summary!;
  const e = health.executions_summary!;
  const a = health.approvals_summary!;

  return (
    <div className="space-y-6">
      <GoNoGoBanner status={health.go_no_go_status} blockers={health.blockers} />

      <div>
        <h3 className="text-sm font-medium mb-2">Registry</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Ações totais" value={r.total} />
          <StatCard label="Ativas" value={r.active} tone="success" />
          <StatCard label="Exigem aprovação" value={r.approval_required} />
          <StatCard
            label="Por executor"
            value={Object.entries(r.by_executor_type)
              .map(([k, v]) => `${k}:${v}`)
              .join(' · ')}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard
            label="Por risco"
            value={Object.entries(r.by_risk_level)
              .map(([k, v]) => `${k}:${v}`)
              .join(' · ')}
          />
          <StatCard
            label="Por superfície"
            value={Object.entries(r.by_surface)
              .map(([k, v]) => `${k}:${v}`)
              .join(' · ')}
          />
          <StatCard
            label="Sem available_surfaces"
            value={health.actions_without_surface ?? 0}
            tone={(health.actions_without_surface ?? 0) > 0 ? 'danger' : 'success'}
          />
          <StatCard
            label="Risco alto/crítico sem approval"
            value={health.risky_actions_without_approval ?? 0}
            tone={(health.risky_actions_without_approval ?? 0) > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Execuções (organização)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Últimas 24h" value={e.last_24h} />
          <StatCard
            label="Falhas 24h"
            value={e.failed_24h}
            tone={e.failed_24h > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Aguardando aprovação"
            value={e.awaiting_approval}
            tone={e.awaiting_approval > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Pending > 5min"
            value={e.pending_over_5min}
            tone={e.pending_over_5min > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Aprovações sensíveis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Pendentes"
            value={a.pending}
            tone={a.pending > 0 ? 'warning' : 'default'}
          />
          <StatCard label="Aprovadas 24h" value={a.approved_24h} />
          <StatCard label="Rejeitadas 24h" value={a.rejected_24h} />
          <StatCard
            label="Approvals sem execução"
            value={health.orphan_approvals ?? 0}
            tone={(health.orphan_approvals ?? 0) > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Auditoria</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Eventos 24h"
            value={health.audit_events_24h ?? 0}
            tone={(health.audit_events_24h ?? 0) > 0 ? 'success' : 'warning'}
            hint="unified_audit_view"
          />
        </div>
      </div>
    </div>
  );
}

function RegistryTab() {
  const { data, isLoading } = useActionRegistry();
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [executorFilter, setExecutorFilter] = useState<string>('all');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return (data ?? []).filter((a: any) => {
      if (search && !a.action_key.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskFilter !== 'all' && a.risk_level !== riskFilter) return false;
      if (executorFilter !== 'all' && a.executor_type !== executorFilter) return false;
      if (surfaceFilter !== 'all' && !(a.available_surfaces ?? []).includes(surfaceFilter))
        return false;
      if (approvalFilter !== 'all') {
        const want = approvalFilter === 'yes';
        if (a.approval_required !== want) return false;
      }
      if (activeFilter !== 'all') {
        const want = activeFilter === 'active';
        if (a.is_active !== want) return false;
      }
      return true;
    });
  }, [data, search, riskFilter, executorFilter, surfaceFilter, approvalFilter, activeFilter]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar action_key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Risco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os riscos</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={executorFilter} onValueChange={setExecutorFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Executor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos executors</SelectItem>
            <SelectItem value="rpc">rpc</SelectItem>
            <SelectItem value="edge_function">edge_function</SelectItem>
            <SelectItem value="service">service</SelectItem>
            <SelectItem value="manual">manual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={surfaceFilter} onValueChange={setSurfaceFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Superfície" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas superfícies</SelectItem>
            <SelectItem value="web">web</SelectItem>
            <SelectItem value="agent">agent</SelectItem>
            <SelectItem value="api">api</SelectItem>
            <SelectItem value="mcp">mcp</SelectItem>
            <SelectItem value="slack">slack</SelectItem>
            <SelectItem value="whatsapp">whatsapp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={approvalFilter} onValueChange={setApprovalFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Aprovação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Aprovação · todas</SelectItem>
            <SelectItem value="yes">Exige aprovação</SelectItem>
            <SelectItem value="no">Sem aprovação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>action_key</TableHead>
              <TableHead>Executor</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Aprovação</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Surfaces</TableHead>
              <TableHead>Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma ação corresponde aos filtros.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((a: any) => (
              <TableRow key={a.action_key}>
                <TableCell>
                  <div className="font-mono text-xs">{a.action_key}</div>
                  <div className="text-xs text-muted-foreground">{a.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{a.executor_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      a.risk_level === 'critical' || a.risk_level === 'high'
                        ? 'destructive'
                        : a.risk_level === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {a.risk_level}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.approval_required ? (
                    <Badge>obrigatória</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{a.required_role ?? '—'}</TableCell>
                <TableCell className="text-xs">
                  {(a.available_surfaces ?? []).join(', ') || (
                    <span className="text-destructive">vazio</span>
                  )}
                </TableCell>
                <TableCell>
                  {a.is_active ? (
                    <Badge variant="outline" className="text-emerald-600">ativa</Badge>
                  ) : (
                    <Badge variant="secondary">inativa</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ExecutionsTab() {
  const [status, setStatus] = useState('all');
  const [windowH, setWindowH] = useState('24');
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const { data, isLoading } = useActionExecutions({
    status: status === 'all' ? undefined : status,
    windowHours: parseInt(windowH),
    onlyOrphans,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="running">running</SelectItem>
            <SelectItem value="awaiting_approval">awaiting_approval</SelectItem>
            <SelectItem value="succeeded">succeeded</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
            <SelectItem value="blocked">blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={windowH} onValueChange={setWindowH}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">Últimas 2h</SelectItem>
            <SelectItem value="24">Últimas 24h</SelectItem>
            <SelectItem value="168">Últimos 7d</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={onlyOrphans ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyOrphans((v) => !v)}
        >
          Somente órfãs (&gt;5min)
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>action_key</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sem execuções no período.
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {formatDistanceToNow(new Date(r.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.action_key}</TableCell>
                  <TableCell className="text-xs">{r.actor_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === 'succeeded'
                          ? 'default'
                          : r.status === 'failed' || r.status === 'blocked'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {r.approval_id ? r.approval_id.slice(0, 8) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-xs truncate">
                    {r.error_message ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ApprovalsTab() {
  const { data, isLoading } = useApprovalQueue();
  const decide = useDecideApproval();

  if (isLoading) return <Skeleton className="h-96" />;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Solicitada</TableHead>
            <TableHead>action_key</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Execução</TableHead>
            <TableHead>Decisão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Sem aprovações registradas.
              </TableCell>
            </TableRow>
          )}
          {(data ?? []).map((r: any) => {
            const isSandbox = r.action_key?.startsWith('sandbox.');
            return (
              <TableRow key={r.id}>
                <TableCell className="text-xs">
                  {formatDistanceToNow(new Date(r.requested_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.action_key}</TableCell>
                <TableCell>
                  <Badge variant={r.risk_level === 'critical' ? 'destructive' : 'secondary'}>
                    {r.risk_level}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === 'pending'
                        ? 'secondary'
                        : r.status === 'approved'
                          ? 'default'
                          : 'destructive'
                    }
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {r.execution_id ? (
                    r.execution_id.slice(0, 8)
                  ) : (
                    <span className="text-destructive">sem exec</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{r.decision_reason ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {r.status === 'pending' && isSandbox ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() =>
                          decide
                            .mutateAsync({
                              approvalId: r.id,
                              decision: 'approved',
                              reason: 'Sandbox approval via Lab',
                            })
                            .then(() => toast({ title: 'Aprovação registrada' }))
                            .catch((e) =>
                              toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
                            )
                        }
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          decide
                            .mutateAsync({
                              approvalId: r.id,
                              decision: 'rejected',
                              reason: 'Sandbox reject via Lab',
                            })
                            .then(() => toast({ title: 'Rejeição registrada' }))
                            .catch((e) =>
                              toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
                            )
                        }
                      >
                        Rejeitar
                      </Button>
                    </div>
                  ) : r.status === 'pending' ? (
                    <span className="text-xs text-muted-foreground">
                      Decisão real fora do Lab
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TestRunnerTab() {
  const { data: runs } = useTestRuns();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { data: results } = useTestResults(activeRunId);
  const runMut = useRunSandboxTests();

  const lastRun = runs?.[0];
  const visibleRunId = activeRunId ?? lastRun?.id ?? null;
  const { data: visibleResults } = useTestResults(visibleRunId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sandbox Test Runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Executa {SANDBOX_TESTS.length} testes controlados usando ações sandbox dedicadas. Nenhum
            dado real é alterado.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                runMut
                  .mutateAsync()
                  .then((r) => {
                    setActiveRunId(r.runId);
                    toast({ title: 'Test run finalizado', description: `Run ${r.runId.slice(0, 8)}` });
                  })
                  .catch((e) =>
                    toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
                  )
              }
              disabled={runMut.isPending}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {runMut.isPending ? 'Executando...' : 'Rodar suíte sandbox'}
            </Button>
            {lastRun && (
              <Badge variant="outline">
                Última: {lastRun.status} · {formatDistanceToNow(new Date(lastRun.started_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {visibleResults && visibleResults.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Teste</TableHead>
                <TableHead>action_key</TableHead>
                <TableHead>Audit</TableHead>
                <TableHead>execution_id</TableHead>
                <TableHead>approval_id</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleResults.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.status === 'passed' ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> passed
                      </Badge>
                    ) : r.status === 'failed' || r.status === 'error' ? (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" /> {r.status}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" /> {r.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.test_name}</TableCell>
                  <TableCell className="font-mono text-[10px]">{r.action_key ?? '—'}</TableCell>
                  <TableCell>
                    {r.audit_found === true ? (
                      <Badge variant="outline" className="text-emerald-600">sim</Badge>
                    ) : r.audit_found === false ? (
                      <Badge variant="outline">não</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {r.execution_id ? r.execution_id.slice(0, 8) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {r.approval_id ? r.approval_id.slice(0, 8) : '—'}
                  </TableCell>
                  <TableCell className="text-xs max-w-md">
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">ver</summary>
                      <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all bg-muted p-2 rounded">
                        {JSON.stringify(
                          { expected: r.expected_result, actual: r.actual_result, error: r.error_message },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {runs && runs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Histórico de runs</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r: any) => (
                  <TableRow
                    key={r.id}
                    className={visibleRunId === r.id ? 'bg-muted/40' : ''}
                  >
                    <TableCell className="text-xs">
                      {new Date(r.started_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'passed'
                            ? 'default'
                            : r.status === 'running'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {JSON.stringify(r.summary)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setActiveRunId(r.id)}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = useUnifiedAudit(200);
  if (isLoading) return <Skeleton className="h-96" />;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>action_key</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Sem eventos de auditoria.
              </TableCell>
            </TableRow>
          )}
          {(data ?? []).map((r: any) => (
            <TableRow key={`${r.source}-${r.id}`}>
              <TableCell className="text-xs">
                {formatDistanceToNow(new Date(r.occurred_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.source}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{r.action_key}</TableCell>
              <TableCell className="text-xs">{r.actor_type}</TableCell>
              <TableCell className="text-xs">{r.entity_type ?? '—'}</TableCell>
              <TableCell className="text-xs">{r.status ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function HeadlessHumanoidLabPage() {
  const { isAdmin, isOwner, loading } = useCurrentOrganization();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin && !isOwner) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Acesso restrito</AlertTitle>
        <AlertDescription>
          O Headless Humanoid Lab é restrito a owners e admins da organização.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Headless Humanoid Lab</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Valide se o NOID RevenueOS está pronto para agentes, APIs, tools e superfícies externas.
        </p>
      </div>

      <Tabs defaultValue="snapshot">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="snapshot" className="gap-2">
            <Activity className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="registry" className="gap-2">
            <GitBranch className="h-4 w-4" /> Action Registry
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-2">
            <ListChecks className="h-4 w-4" /> Execuções
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Aprovações
          </TabsTrigger>
          <TabsTrigger value="tests" className="gap-2">
            <PlayCircle className="h-4 w-4" /> Test Runner
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Eye className="h-4 w-4" /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="mt-4">
          <SnapshotTab />
        </TabsContent>
        <TabsContent value="registry" className="mt-4">
          <RegistryTab />
        </TabsContent>
        <TabsContent value="executions" className="mt-4">
          <ExecutionsTab />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalsTab />
        </TabsContent>
        <TabsContent value="tests" className="mt-4">
          <TestRunnerTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
