// NOID-VERTICAL-1.0-VERT-01.2C
// Página administrativa genérica de Provider de Inventário.
// Fonte canônica: inventory_provider_settings (via useInventoryProviderSettings).
// Provider ativo: useInventoryProvider (resolver canonical → legacy → native).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AccessDenied } from '@/components/AccessDenied';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useInventoryProvider } from '@/inventory/hooks/useInventoryProvider';
import {
  useInventoryProviderSettings,
} from '@/inventory/hooks/useInventoryProviderSettings';
import { useEventrixInventorySettings } from '@/hooks/settings/useEventrixInventory';
import { EventrixInventoryProviderPanel } from './EventrixInventorySettings';
import type {
  InventoryProviderCapability,
  InventoryProviderStatusCode,
  InventoryProviderType,
} from '@/inventory/providers/types';
import { toast } from 'sonner';
import { Boxes, Check, Info, Plug, ShieldCheck } from 'lucide-react';

const STATUS_LABELS: Record<InventoryProviderStatusCode, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponível', variant: 'default' },
  not_configured: { label: 'Não configurado', variant: 'outline' },
  unavailable: { label: 'Indisponível', variant: 'outline' },
  degraded: { label: 'Operação degradada', variant: 'secondary' },
  unauthorized: { label: 'Sem autorização', variant: 'destructive' },
  error: { label: 'Erro de configuração', variant: 'destructive' },
};

const CAPABILITY_LABELS: Record<InventoryProviderCapability, string> = {
  categories: 'Categorias',
  families: 'Famílias',
  items: 'Itens',
  availability: 'Disponibilidade',
  reservations: 'Reservas',
  kits: 'Kits',
  serialized_items: 'Itens serializados',
  quantity_items: 'Itens por quantidade',
  product_requirements: 'Requisitos de produtos',
  proposal_demand: 'Demanda de propostas',
};

const SOURCE_LABELS: Record<string, string> = {
  canonical_provider_settings: 'Configuração da empresa',
  legacy_eventrix_settings: 'Sincronizada com configuração Eventrix',
  native_default: 'Padrão da plataforma',
};

const SELECTION_SOURCE_LABELS: Record<string, string> = {
  manual: 'Configuração da empresa',
  legacy_backfill: 'Configuração migrada',
  legacy_eventrix_settings: 'Sincronizada com configuração Eventrix',
};

interface ProviderCard {
  type: InventoryProviderType;
  name: string;
  description: string;
  capabilities: InventoryProviderCapability[];
  notice?: string;
}

const PROVIDER_CARDS: ProviderCard[] = [
  {
    type: 'native',
    name: 'Inventário Nativo',
    description:
      'Utiliza o catálogo do NOID sem sincronização obrigatória com um sistema externo.',
    capabilities: [],
    notice:
      'O provider nativo ainda não controla disponibilidade ou reservas. Produtos podem ser cadastrados normalmente, sem dependência de integração externa.',
  },
  {
    type: 'eventrix',
    name: 'Eventrix',
    description: 'Integração opcional para categorias, famílias e requisitos de inventário.',
    capabilities: ['categories', 'families', 'product_requirements'],
  },
];

export default function InventoryProviderSettingsPage() {
  const { loading, isOwner, isAdmin, orgRole } = usePermissions();
  const { organization } = useCurrentOrganization();
  const [params, setParams] = useSearchParams();

  const canRead =
    isOwner ||
    isAdmin ||
    orgRole === 'operations' ||
    orgRole === 'operacional' ||
    orgRole === 'commercial_manager' ||
    orgRole === 'sales_manager';
  const canWrite = isOwner || isAdmin;

  const providerQ = useInventoryProvider(organization?.id);
  const {
    settings,
    source: canonicalSource,
    upsertProvider,
    isSaving,
    refresh: refreshSettings,
  } = useInventoryProviderSettings();
  const eventrixSettingsQuery = useEventrixInventorySettings();

  const [confirmNative, setConfirmNative] = useState(false);
  const initialWantEventrix = params.get('provider') === 'eventrix';
  const [showEventrixPanel, setShowEventrixPanel] = useState(initialWantEventrix);

  useEffect(() => {
    if (initialWantEventrix) setShowEventrixPanel(true);
  }, [initialWantEventrix]);

  const activeType = providerQ.providerType ?? 'native';
  const status = providerQ.status?.code ?? 'available';
  const capabilities = providerQ.capabilities ?? [];

  const resolutionSourceLabel = useMemo(() => {
    const rSource = providerQ.resolution?.source;
    if (rSource && SOURCE_LABELS[rSource]) return SOURCE_LABELS[rSource];
    if (canonicalSource && SELECTION_SOURCE_LABELS[canonicalSource]) {
      return SELECTION_SOURCE_LABELS[canonicalSource];
    }
    return 'Padrão da plataforma';
  }, [providerQ.resolution?.source, canonicalSource]);

  const eventrixReady = useMemo(() => {
    const s = eventrixSettingsQuery.data;
    if (!s) return false;
    if (!s.is_enabled) return false;
    if (!s.base_url) return false;
    return s.status !== 'error' && s.status !== 'not_configured';
  }, [eventrixSettingsQuery.data]);

  if (loading) return null;

  if (!canRead) {
    return (
      <Layout pageTitle="Provider de Inventário">
        <AccessDenied
          title="Acesso restrito"
          description="Esta configuração é reservada aos perfis Owner, Admin, Operacional e Gestores Comerciais."
        />
      </Layout>
    );
  }

  const handleSelectNative = async () => {
    setConfirmNative(false);
    try {
      await upsertProvider({
        provider_type: 'native',
        is_enabled: true,
        selection_source: 'manual',
      });
      toast.success('Provider nativo ativado. Configurações Eventrix preservadas.');
      await providerQ.refresh();
    } catch (err) {
      toast.error('Não foi possível ativar o provider nativo.');
    }
  };

  const handleSelectEventrix = async () => {
    if (!eventrixReady) {
      setShowEventrixPanel(true);
      const next = new URLSearchParams(params);
      next.set('provider', 'eventrix');
      setParams(next, { replace: true });
      toast.info('Configure a integração Eventrix abaixo antes de ativá-la como provider.');
      return;
    }
    try {
      await upsertProvider({
        provider_type: 'eventrix',
        is_enabled: true,
        selection_source: 'manual',
      });
      toast.success('Eventrix definido como provider ativo.');
      await providerQ.refresh();
      await refreshSettings();
    } catch (err) {
      toast.error('Não foi possível ativar o Eventrix como provider.');
    }
  };

  const statusMeta = STATUS_LABELS[status];

  return (
    <Layout pageTitle="Provider de Inventário">
      <PageContainer>
        <PageHeader
          icon={Boxes}
          title="Provider de Inventário"
          subtitle="Defina como o NOID consulta categorias, famílias, itens e disponibilidade para esta empresa."
          badge={{ label: 'Configuração da empresa', icon: ShieldCheck }}
          variant="teal"
        />

        <div className="space-y-6">
          {/* Provider ativo */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Provider ativo</CardTitle>
                  <CardDescription className="mt-1">
                    Resolução calculada em tempo real para esta organização.
                  </CardDescription>
                </div>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {providerQ.isLoading ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Provider</div>
                    <div className="font-medium">{providerQ.providerName ?? 'Inventário Nativo'}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Tipo técnico: <code className="text-xs">{activeType}</code>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Origem da seleção</div>
                    <div className="font-medium">{resolutionSourceLabel}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Capacidades</div>
                    <div className="font-medium">
                      {capabilities.length === 0
                        ? 'Nenhuma capacidade avançada'
                        : `${capabilities.length} capacidade${capabilities.length > 1 ? 's' : ''}`}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {capabilities.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">
                          {CAPABILITY_LABELS[c] ?? c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {providerQ.status?.code === 'error' && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Erro de configuração</AlertTitle>
                  <AlertDescription>
                    {providerQ.status.message ?? 'Não foi possível resolver o provider.'}
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto ml-2"
                      onClick={() => providerQ.refresh()}
                    >
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!canWrite && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Somente leitura</AlertTitle>
                  <AlertDescription>
                    Apenas Owner e Admin podem alterar o provider de inventário.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Providers disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle>Providers disponíveis</CardTitle>
              <CardDescription>
                Escolha a fonte de inventário que melhor se adapta à operação desta empresa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {PROVIDER_CARDS.map((p) => {
                  const isActive = activeType === p.type;
                  return (
                    <div
                      key={p.type}
                      className={`rounded-lg border p-4 flex flex-col gap-3 ${
                        isActive ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {p.type === 'eventrix' ? (
                              <Plug className="h-4 w-4" />
                            ) : (
                              <Boxes className="h-4 w-4" />
                            )}
                            {p.name}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {p.description}
                          </p>
                        </div>
                        {isActive && (
                          <Badge variant="default" className="shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {p.capabilities.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Sem capacidades avançadas declaradas.
                          </span>
                        ) : (
                          p.capabilities.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">
                              {CAPABILITY_LABELS[c] ?? c}
                            </Badge>
                          ))
                        )}
                      </div>

                      {p.notice && (
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          {p.notice}
                        </p>
                      )}

                      {canWrite && !isActive && (
                        <div className="pt-1">
                          {p.type === 'native' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => setConfirmNative(true)}
                            >
                              Ativar provider nativo
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSaving}
                              onClick={handleSelectEventrix}
                            >
                              {eventrixReady ? 'Ativar Eventrix' : 'Configurar Eventrix'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Painel específico Eventrix */}
          {(showEventrixPanel || activeType === 'eventrix') && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plug className="h-5 w-5" />
                      Configuração Eventrix
                    </CardTitle>
                    <CardDescription>
                      Painel específico da integração Eventrix. Preservado para compatibilidade
                      total com a operação atual.
                    </CardDescription>
                  </div>
                  {!showEventrixPanel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEventrixPanel(true)}
                    >
                      Expandir
                    </Button>
                  )}
                </div>
              </CardHeader>
              {showEventrixPanel && (
                <CardContent>
                  <EventrixInventoryProviderPanel />
                </CardContent>
              )}
            </Card>
          )}
        </div>

        <AlertDialog open={confirmNative} onOpenChange={setConfirmNative}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ativar provider nativo?</AlertDialogTitle>
              <AlertDialogDescription>
                Ao utilizar o provider nativo, o NOID deixará de usar o Eventrix como fonte
                ativa de inventário. As configurações e dados de integração existentes
                serão preservados e poderão ser reativados a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSelectNative}>
                Ativar nativo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </Layout>
  );
}
