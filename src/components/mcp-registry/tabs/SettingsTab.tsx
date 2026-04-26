import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateMcpSettings, useMcpSettings, useUpdateMcpSettings } from '@/hooks/useMcpRegistry';
import { MCPEmptyState } from '../MCPEmptyState';
import { MCPJsonEditor } from '../MCPJsonEditor';
import { MCPConfirmDialog } from '../MCPConfirmDialog';
import { Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsTab() {
  const { data: settings, isLoading } = useMcpSettings();
  const createSettings = useCreateMcpSettings();
  const updateSettings = useUpdateMcpSettings();

  const [isMcpEnabled, setIsMcpEnabled] = useState(false);
  const [allowExternal, setAllowExternal] = useState(false);
  const [defaultRequiresApproval, setDefaultRequiresApproval] = useState(true);
  const [defaultDailyLimit, setDefaultDailyLimit] = useState<number>(100);
  const [logRetentionDays, setLogRetentionDays] = useState<number>(180);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [metaValid, setMetaValid] = useState(true);

  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmExternal, setConfirmExternal] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setIsMcpEnabled(settings.is_mcp_enabled);
    setAllowExternal(settings.allow_external_servers);
    setDefaultRequiresApproval(settings.default_requires_approval);
    setDefaultDailyLimit(settings.default_daily_call_limit);
    setLogRetentionDays(settings.log_retention_days);
    setMetadata(settings.metadata ?? {});
  }, [settings]);

  if (isLoading) return <Skeleton className="h-96" />;

  if (!settings) {
    return (
      <MCPEmptyState
        title="Settings MCP ainda não foram criadas para esta organização"
        description="Crie as configurações padrão para começar a operar o MCP Registry. Tudo nasce desativado e seguro."
        icon={SettingsIcon}
        action={
          <Button
            onClick={async () => {
              try {
                await createSettings.mutateAsync();
                toast.success('Settings criadas.');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
              }
            }}
            disabled={createSettings.isPending}
          >
            Criar settings MCP para esta organização
          </Button>
        }
      />
    );
  }

  const handleSave = async () => {
    if (defaultDailyLimit <= 0) return toast.error('Limite diário deve ser maior que 0.');
    if (logRetentionDays <= 0) return toast.error('Retenção de logs deve ser maior que 0.');
    if (!metaValid) return toast.error('JSON inválido. Corrija antes de salvar.');
    try {
      await updateSettings.mutateAsync({
        id: settings.id,
        input: {
          is_mcp_enabled: isMcpEnabled,
          allow_external_servers: allowExternal,
          default_requires_approval: defaultRequiresApproval,
          default_daily_call_limit: defaultDailyLimit,
          log_retention_days: logRetentionDays,
          metadata,
        },
      });
      toast.success('Settings atualizadas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  const handleToggleEnabled = (next: boolean) => {
    if (next && !isMcpEnabled) {
      setConfirmEnable(true);
      return;
    }
    setIsMcpEnabled(next);
  };
  const handleToggleExternal = (next: boolean) => {
    if (next && !allowExternal) {
      setConfirmExternal(true);
      return;
    }
    setAllowExternal(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle>Configurações MCP da organização</CardTitle>
          </div>
          <CardDescription>Controle a fundação MCP. Tudo permanece seguro até ativação consciente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <Label className="text-sm font-medium">MCP habilitado</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ativa a fundação MCP para agentes do NOID Intelligence.
              </p>
            </div>
            <Switch checked={isMcpEnabled} onCheckedChange={handleToggleEnabled} />
          </div>

          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                Permitir servidores externos
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permite cadastrar servidores MCP fora do NOID. Manter desligado nesta fase.
              </p>
            </div>
            <Switch checked={allowExternal} onCheckedChange={handleToggleExternal} />
          </div>

          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <Label className="text-sm font-medium">Exigir aprovação por padrão</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define se novas tools sensíveis devem exigir aprovação humana.
              </p>
            </div>
            <Switch checked={defaultRequiresApproval} onCheckedChange={setDefaultRequiresApproval} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Limite diário padrão de chamadas</Label>
              <Input
                type="number"
                min={1}
                value={defaultDailyLimit}
                onChange={(e) => setDefaultDailyLimit(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Define o limite preventivo para chamadas futuras.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Retenção de logs (dias)</Label>
              <Input
                type="number"
                min={1}
                value={logRetentionDays}
                onChange={(e) => setLogRetentionDays(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Define por quantos dias logs MCP serão mantidos.</p>
            </div>
          </div>

          <div>
            <MCPJsonEditor
              label="Metadata (JSON)"
              value={metadata}
              onChange={(parsed, valid) => {
                if (valid) setMetadata((parsed as Record<string, unknown>) ?? {});
                setMetaValid(valid);
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateSettings.isPending || !metaValid}>
              {updateSettings.isPending ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <MCPConfirmDialog
        open={confirmEnable}
        onOpenChange={setConfirmEnable}
        title="Ativar MCP?"
        description="Ativar o MCP permite que futuras simulações e permissões usem esta fundação. Nenhuma tool real será executada nesta sprint."
        confirmLabel="Ativar"
        onConfirm={() => {
          setIsMcpEnabled(true);
          setConfirmEnable(false);
        }}
      />

      <MCPConfirmDialog
        open={confirmExternal}
        onOpenChange={setConfirmExternal}
        title="Permitir servidores externos?"
        description="Servidores externos aumentam a superfície de risco. Ative apenas se souber exatamente o que está conectando."
        confirmLabel="Permitir"
        destructive
        onConfirm={() => {
          setAllowExternal(true);
          setConfirmExternal(false);
        }}
      />
    </div>
  );
}
