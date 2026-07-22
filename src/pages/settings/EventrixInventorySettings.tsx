import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessDenied } from '@/components/AccessDenied';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useEventrixInventorySettings,
  useUpsertEventrixInventorySettings,
  useTestEventrixInventoryConnection,
  useEventrixInventorySyncCache,
  useTriggerEventrixInventorySync,
} from '@/hooks/settings/useEventrixInventory';
import {
  eventrixInventorySettingsSchema,
  type EventrixInventorySettingsInput,
  type EventrixInventoryStatus,
} from '@/schemas/eventrixInventorySettings';
import { toast } from 'sonner';
import {
  Boxes,
  Cable,
  Radar,
  Layers,
  MapPin,
  AlertTriangle,
  Workflow,
  Plug,
  Server,
  ShieldCheck,
  RefreshCw,
  Save,
  Zap,
  ListChecks,
} from 'lucide-react';

const STATUS_META: Record<
  EventrixInventoryStatus,
  { label: string; description: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  not_configured: {
    label: 'Não configurado',
    description: 'Integração ainda não configurada.',
    variant: 'outline',
  },
  configured: {
    label: 'Configurado',
    description: 'Configuração local pronta para conexão futura.',
    variant: 'secondary',
  },
  connected: {
    label: 'Conectado',
    description: 'Conexão com Eventrix ativa.',
    variant: 'default',
  },
  error: {
    label: 'Erro',
    description: 'Erro na configuração da integração.',
    variant: 'destructive',
  },
  disabled: {
    label: 'Desativada',
    description: 'Integração desativada.',
    variant: 'outline',
  },
};

const consumedData = [
  {
    icon: Layers,
    title: 'Categorias',
    status: 'Futuro sync',
    description:
      'Pilares macro do inventário, como Conectividade, Credenciamento, Acesso, Sensoriamento, Totens e Infraestrutura.',
  },
  {
    icon: Cable,
    title: 'Famílias',
    status: 'Futuro sync',
    description:
      'Subgrupos operacionais, como Roteadores 5G, Chips de Dados, Cabos de Rede, BLE Beacons e Totens.',
  },
  {
    icon: MapPin,
    title: 'Disponibilidade',
    status: 'Futura API',
    description:
      'Consulta se os recursos exigidos por uma proposta estão disponíveis no período operacional.',
  },
  {
    icon: Radar,
    title: 'Ocupação',
    status: 'Futura API',
    description: 'Percentual de comprometimento do estoque no período consultado.',
  },
  {
    icon: AlertTriangle,
    title: 'Alertas comerciais',
    status: 'Futura API',
    description:
      'Sinais como estoque crítico, indisponível, parcialmente disponível ou sujeito à aprovação operacional.',
  },
];

const responsibilities = [
  { system: 'Eventrix', role: 'Fonte oficial do inventário físico, reservas, movimentações e disponibilidade.' },
  { system: 'NOID CRM', role: 'Produtos comerciais, propostas, composição de inventário e aplicação comercial da disponibilidade.' },
  { system: 'ERP', role: 'Patrimônio, custos, compras, baixas e impactos financeiros.' },
];

const bomExample = [
  { product: 'LEGAL Core Indoor', category: 'Conectividade', family: 'Roteadores 5G', qty: 1 },
  { product: 'LEGAL X Go Pro', category: 'Conectividade', family: 'Roteadores 5G', qty: 1 },
  { product: 'LEGAL X Go Pro', category: 'Conectividade', family: 'Chips de Dados', qty: 2 },
];

const demandFactors = [
  { range: 'Menor que 50%', factor: '0%' },
  { range: '50% a 75%', factor: '+10% no valor da solução' },
  { range: '76% a 90%', factor: '+20% no valor da solução' },
  { range: 'Acima de 90%', factor: '+30% no valor da solução' },
];

const futureFlow = [
  'Vendedor monta a proposta no NOID',
  'NOID identifica a composição de inventário dos produtos',
  'NOID consulta o Eventrix',
  'Eventrix retorna disponibilidade, ocupação e alertas',
  'NOID aplica fator de demanda na tabela dinâmica',
  'Proposta salva snapshot da consulta',
];

const endpoints = [
  'GET categorias do inventário',
  'GET famílias do inventário',
  'POST consulta de disponibilidade',
  'POST criação de pré-reserva',
  'POST confirmação de reserva',
  'POST cancelamento/liberação de reserva',
];

const nextSteps = [
  'Conectar API real do Eventrix',
  'Sincronizar categorias e famílias oficiais',
  'Vincular produtos comerciais às famílias do Eventrix',
  'Consultar disponibilidade na proposta',
  'Aplicar fator de demanda na tabela dinâmica',
  'Salvar snapshot da consulta na proposta',
];

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

function controlModeLabel(mode: string | null): string {
  if (mode === 'serialized') return 'Serializado';
  if (mode === 'quantity') return 'Por quantidade';
  if (mode === 'mixed') return 'Mista';
  return '—';
}

function itemKindLabel(kind: string | null): string {
  if (kind === 'serialized') return 'Serializado';
  if (kind === 'quantity') return 'Por quantidade';
  return '—';
}

// NOID-VERTICAL-1.0-VERT-01.2C
// Painel específico Eventrix reutilizável pela nova página genérica de
// Provider de Inventário. Contém apenas o corpo (sem Layout/PageHeader).
export function EventrixInventoryProviderPanel() {
  const { isOwner, isAdmin, orgRole } = usePermissions();

  const canWrite =
    isOwner || isAdmin || orgRole === 'operations' || orgRole === 'operacional';

  const settingsQuery = useEventrixInventorySettings();
  const categoriesQuery = useEventrixInventorySyncCache('category');
  const familiesQuery = useEventrixInventorySyncCache('family');
  const upsert = useUpsertEventrixInventorySettings();
  const testConn = useTestEventrixInventoryConnection();
  const triggerSync = useTriggerEventrixInventorySync();

  const [form, setForm] = useState<EventrixInventorySettingsInput>({
    environment: 'sandbox',
    base_url: '',
    api_key_secret_name: '',
    is_enabled: false,
  });
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const s = settingsQuery.data;
    if (s) {
      setForm({
        environment: s.environment,
        base_url: s.base_url ?? '',
        api_key_secret_name: s.api_key_secret_name ?? '',
        is_enabled: s.is_enabled,
      });
    }
  }, [settingsQuery.data]);

  const status: EventrixInventoryStatus =
    settingsQuery.data?.status ?? 'not_configured';
  const statusMeta = STATUS_META[status];

  const handleSave = () => {
    const parsed = eventrixInventorySettingsSchema.safeParse({
      environment: form.environment,
      base_url: form.base_url?.trim() || null,
      api_key_secret_name: form.api_key_secret_name?.trim() || null,
      is_enabled: form.is_enabled,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      if (first?.path[0] === 'base_url') {
        setUrlError(first.message);
      }
      toast.error(first?.message ?? 'Verifique os campos.');
      return;
    }
    setUrlError(null);
    upsert.mutate(parsed.data, {
      onSuccess: () => toast.success('Configuração salva com sucesso.'),
      onError: () => toast.error('Não foi possível salvar a configuração.'),
    });
  };

  const handleTest = () => {
    testConn.mutate(undefined, {
      onSuccess: ({ hasUrl }) => {
        if (hasUrl) {
          toast.success(
            'Configuração local validada. Teste real será ativado em etapa futura.',
          );
        } else {
          toast.error('Configure a URL base do Eventrix antes de testar.');
        }
      },
      onError: () => toast.error('Não foi possível testar a conexão.'),
    });
  };

  const handleSync = () => {
    triggerSync.mutate(undefined, {
      onSuccess: () =>
        toast.info(
          'Sincronização real será ativada após a API do Eventrix estar disponível.',
        ),
      onError: () => toast.error('Não foi possível iniciar a sincronização.'),
    });
  };

  const categories = categoriesQuery.data ?? [];
  const families = familiesQuery.data ?? [];
  const familyCategoryName = (parentId: string | null) => {
    if (!parentId) return '—';
    return categories.find((c) => c.eventrix_entity_id === parentId)?.name ?? parentId;
  };

  return (
    <div className="space-y-6">
          {/* Bloco 1 — Configuração da conexão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Configuração da conexão
              </CardTitle>
              <CardDescription>
                Informe os dados básicos da conexão com o Eventrix. A integração real será
                ativada em etapa futura.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select
                    value={form.environment}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, environment: v as 'sandbox' | 'production' }))
                    }
                    disabled={!canWrite}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Homologação / Sandbox</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>URL base do Eventrix</Label>
                  <Input
                    placeholder="Ex: https://eventrix.operadora.legal"
                    value={form.base_url ?? ''}
                    maxLength={200}
                    disabled={!canWrite}
                    onChange={(e) => {
                      setUrlError(null);
                      setForm((f) => ({ ...f, base_url: e.target.value }));
                    }}
                  />
                  {urlError && (
                    <p className="text-xs text-destructive">{urlError}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Referência do token/API key</Label>
                  <Input
                    placeholder="Ex: EVENTRIX_INVENTORY_API_KEY"
                    value={form.api_key_secret_name ?? ''}
                    maxLength={120}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, api_key_secret_name: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Não informe o token diretamente aqui. Use apenas o nome do segredo
                    configurado no ambiente.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Ativar integração</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativa, o NOID passará a usar dados sincronizados do Eventrix nas
                    próximas etapas.
                  </p>
                </div>
                <Switch
                  checked={form.is_enabled}
                  disabled={!canWrite}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))}
                />
              </div>

              {canWrite && (
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={upsert.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {upsert.isPending ? 'Salvando...' : 'Salvar configuração'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bloco 2 — Teste de conexão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Teste de conexão
              </CardTitle>
              <CardDescription>
                Valide se a configuração está pronta para conexão com o Eventrix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Último teste: <strong>{formatDateTime(settingsQuery.data?.last_connection_check_at)}</strong>
                  {settingsQuery.data?.last_connection_status && (
                    <> · Status: <strong>{settingsQuery.data.last_connection_status}</strong></>
                  )}
                </div>
                {canWrite && (
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testConn.isPending}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {testConn.isPending ? 'Testando...' : 'Testar conexão'}
                  </Button>
                )}
              </div>
              {settingsQuery.data?.last_connection_message && (
                <p className="text-xs text-muted-foreground mt-2">
                  {settingsQuery.data.last_connection_message}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bloco 3 — Status da integração */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Status da integração</CardTitle>
                  <CardDescription className="mt-1">{statusMeta.description}</CardDescription>
                </div>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Último teste</div>
                  <div className="font-medium">
                    {formatDateTime(settingsQuery.data?.last_connection_check_at)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Última mensagem</div>
                  <div className="font-medium">
                    {settingsQuery.data?.last_connection_message ?? '—'}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Última sincronização</div>
                  <div className="font-medium">
                    {formatDateTime(settingsQuery.data?.last_sync_at)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 4 — Sincronização */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Sincronização de categorias e famílias
              </CardTitle>
              <CardDescription>
                O NOID usará um cache local das categorias e famílias do Eventrix para
                configurar a composição de inventário dos produtos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Última sincronização: <strong>{formatDateTime(settingsQuery.data?.last_sync_at)}</strong>
                  {settingsQuery.data?.last_sync_status && (
                    <> · Status: <strong>{settingsQuery.data.last_sync_status}</strong></>
                  )}
                </div>
                {canWrite && (
                  <Button
                    variant="outline"
                    onClick={handleSync}
                    disabled={triggerSync.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {triggerSync.isPending
                      ? 'Sincronizando...'
                      : 'Sincronizar categorias e famílias'}
                  </Button>
                )}
              </div>
              {settingsQuery.data?.last_sync_message && (
                <p className="text-xs text-muted-foreground mt-2">
                  {settingsQuery.data.last_sync_message}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bloco 5 — Cache local */}
          <Card>
            <CardHeader>
              <CardTitle>Cache local do Eventrix</CardTitle>
              <CardDescription>
                Categorias e famílias sincronizadas serão exibidas aqui para uso futuro na
                composição de inventário dos produtos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="categories" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="categories">Categorias</TabsTrigger>
                  <TabsTrigger value="families">Famílias</TabsTrigger>
                </TabsList>

                <TabsContent value="categories">
                  {categoriesQuery.isLoading ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : categories.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <div className="font-medium">Nenhuma categoria sincronizada</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        As categorias do Eventrix aparecerão aqui após a sincronização.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Nome</th>
                            <th className="text-left px-4 py-2 font-medium">Modo de controle</th>
                            <th className="text-left px-4 py-2 font-medium">Status</th>
                            <th className="text-left px-4 py-2 font-medium">Última sincronização</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((c) => (
                            <tr key={c.id} className="border-t">
                              <td className="px-4 py-2 font-medium">{c.name}</td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {controlModeLabel(c.control_mode)}
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant={c.is_active ? 'secondary' : 'outline'}>
                                  {c.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {formatDateTime(c.synced_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="families">
                  {familiesQuery.isLoading ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : families.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <div className="font-medium">Nenhuma família sincronizada</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        As famílias do Eventrix aparecerão aqui após a sincronização.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Nome</th>
                            <th className="text-left px-4 py-2 font-medium">Categoria</th>
                            <th className="text-left px-4 py-2 font-medium">Tipo padrão</th>
                            <th className="text-left px-4 py-2 font-medium">Status</th>
                            <th className="text-left px-4 py-2 font-medium">Última sincronização</th>
                          </tr>
                        </thead>
                        <tbody>
                          {families.map((f) => (
                            <tr key={f.id} className="border-t">
                              <td className="px-4 py-2 font-medium">{f.name}</td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {familyCategoryName(f.parent_eventrix_entity_id)}
                              </td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {itemKindLabel(f.item_kind)}
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant={f.is_active ? 'secondary' : 'outline'}>
                                  {f.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {formatDateTime(f.synced_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Bloco 6 — Próximas etapas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Próximas etapas da integração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {nextSteps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Blocos informativos (mantidos da 0.1) */}
          <Card>
            <CardHeader>
              <CardTitle>Responsabilidades dos sistemas</CardTitle>
              <CardDescription>
                O NOID não gerencia mais estoque físico. Ele apenas consome informações operacionais
                do Eventrix para apoiar a venda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Sistema</th>
                      <th className="text-left px-4 py-2 font-medium">Responsabilidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsibilities.map((r) => (
                      <tr key={r.system} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.system}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados consumidos do Eventrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {consumedData.map((item) => (
                  <div key={item.title} className="rounded-lg border p-4 flex flex-col gap-2 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <item.icon className="h-4 w-4 text-primary" />
                        {item.title}
                      </div>
                      <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Composição de Inventário dos Produtos</CardTitle>
              <CardDescription>
                Os produtos comerciais do NOID poderão apontar quais categorias e famílias do
                Eventrix são necessárias para entregar cada solução.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Produto comercial</th>
                      <th className="text-left px-4 py-2 font-medium">Categoria Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Família Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Qtd por unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomExample.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2 font-medium">{row.product}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.category}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.family}</td>
                        <td className="px-4 py-2">{row.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                O produto comercial vive no NOID. O ativo físico vive no Eventrix. A composição
                conecta os dois mundos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fator de demanda por ocupação</CardTitle>
              <CardDescription>
                Quando a integração estiver ativa, o NOID usará a ocupação retornada pelo Eventrix
                para ajustar a tabela dinâmica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Ocupação retornada pelo Eventrix</th>
                      <th className="text-left px-4 py-2 font-medium">Fator aplicado no NOID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandFactors.map((row) => (
                      <tr key={row.range} className="border-t">
                        <td className="px-4 py-2">{row.range}</td>
                        <td className="px-4 py-2 font-medium">{row.factor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                O Eventrix calcula a ocupação. O NOID aplica o fator comercial.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Fluxo futuro na proposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {futureFlow.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Endpoints planejados
              </CardTitle>
              <CardDescription>
                Interface prevista para a próxima sprint de integração. Nenhuma chamada real é
                feita agora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {endpoints.map((e) => (
                  <div
                    key={e}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <code className="font-mono text-xs md:text-sm">{e}</code>
                    <Badge variant="outline" className="text-xs">Planejado</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
  );
}

// NOID-VERTICAL-1.0-VERT-01.2C
// Wrapper legado. A rota /app/settings/eventrix-inventory agora redireciona
// para /app/settings/inventory-provider?provider=eventrix (ver App.tsx).
// Mantido apenas por compatibilidade caso algum consumidor importe direto.
export default function EventrixInventorySettings() {
  const { loading, isOwner, isAdmin, orgRole } = usePermissions();
  const canRead =
    isOwner ||
    isAdmin ||
    orgRole === 'operations' ||
    orgRole === 'operacional' ||
    orgRole === 'commercial_manager' ||
    orgRole === 'sales_manager';
  if (loading) return null;
  if (!canRead) {
    return (
      <Layout pageTitle="Inventário Eventrix">
        <AccessDenied
          title="Acesso restrito"
          description="Esta configuração é reservada aos perfis Owner, Admin, Operacional e Gestores Comerciais."
        />
      </Layout>
    );
  }
  return (
    <Layout pageTitle="Inventário Eventrix">
      <PageContainer>
        <PageHeader
          icon={Boxes}
          title="Inventário conectado ao Eventrix"
          subtitle="O Eventrix será a fonte oficial do inventário físico. O NOID consumirá essas informações para propostas, disponibilidade e tabela dinâmica."
          badge={{ label: 'Eventrix master', icon: ShieldCheck }}
          variant="teal"
        />
        <EventrixInventoryProviderPanel />
      </PageContainer>
    </Layout>
  );
}

