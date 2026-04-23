import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw, Trash2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { initiateGmailOAuth, getEmailSyncConfig, toggleEmailSync, deleteEmailSyncConfig } from '@/services/crm/sync';
import { syncEmailReplies } from '@/services/supabase/opportunity-emails';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GmailSyncSettingsProps {
  userId: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Estado de autenticação inválido. Tente conectar novamente.',
  invalid_signature: 'Assinatura de segurança inválida. Tente conectar novamente.',
  expired_or_used: 'A sessão expirou. Tente conectar novamente.',
  invalid_client: 'Erro de configuração OAuth. Contate o administrador.',
};

export function GmailSyncSettings({ userId }: GmailSyncSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Handle OAuth callback status from URL
    const sync = searchParams.get('sync');
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    if (sync === 'gmail') {
      if (status === 'success') {
        toast.success('Gmail conectado com sucesso!');
      } else if (status === 'error') {
        const errorMsg = message && ERROR_MESSAGES[message] 
          ? ERROR_MESSAGES[message] 
          : 'Erro ao conectar Gmail. Tente novamente.';
        toast.error(errorMsg);
      }
      // Clean URL params
      searchParams.delete('sync');
      searchParams.delete('status');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [userId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getEmailSyncConfig();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar config Gmail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await initiateGmailOAuth();
    } catch (error) {
      console.error('Erro ao conectar Gmail:', error);
      toast.error('Erro ao iniciar conexão com Gmail');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o Gmail? As respostas de e-mail não serão mais sincronizadas.')) return;
    try {
      setDisconnecting(true);
      await deleteEmailSyncConfig();
      setConfig(null);
      toast.success('Gmail desconectado com sucesso');
    } catch (error) {
      console.error('Erro ao desconectar Gmail:', error);
      toast.error('Erro ao desconectar Gmail');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    try {
      await toggleEmailSync(enabled);
      setConfig((prev: any) => prev ? { ...prev, sync_enabled: enabled } : prev);
      toast.success(enabled ? 'Sincronização ativada' : 'Sincronização desativada');
    } catch (error) {
      console.error('Erro ao alternar sync:', error);
      toast.error('Erro ao alterar sincronização');
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const result = await syncEmailReplies();
      if (result.synced > 0) {
        toast.success(`${result.synced} resposta(s) sincronizada(s)!`);
      } else if (result.hint) {
        toast.info(result.hint, { duration: 6000 });
      } else {
        toast.success('Nenhuma nova resposta encontrada.');
      }
      await loadConfig();
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      if (error?.reauthRequired) {
        toast.error('Conexão com o Gmail expirou. Reconectando...', { duration: 4000 });
        try {
          await initiateGmailOAuth();
        } catch {
          toast.error('Não foi possível iniciar a reconexão. Tente novamente.');
        }
      } else {
        toast.error(error?.message || 'Erro ao sincronizar respostas. Verifique se o Gmail ainda está conectado.');
      }
      await loadConfig();
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <CardTitle>Sincronização Gmail</CardTitle>
          </div>
          {config && (
            <div className="flex items-center gap-3">
              {config.sync_enabled ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" /> Desativado
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="gmail-sync-active" className="text-sm">Ativo</Label>
                <Switch
                  id="gmail-sync-active"
                  checked={config.sync_enabled}
                  onCheckedChange={handleToggleSync}
                />
              </div>
            </div>
          )}
        </div>
        <CardDescription>
          Conecte seu Gmail para receber respostas de clientes diretamente no CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!config ? (
          // Not connected
          <div className="text-center py-8">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium mb-2">Gmail não conectado</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Conecte sua conta do Gmail para sincronizar automaticamente as respostas dos clientes 
              aos e-mails enviados pelo CRM. As respostas aparecerão no histórico da oportunidade.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Conectar Gmail
            </Button>
          </div>
        ) : (
          // Connected
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">{config.email_address}</p>
                <p className="text-xs text-muted-foreground">
                  {config.last_sync_at 
                    ? `Última sincronização: ${format(parseISO(config.last_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    : 'Nunca sincronizado'
                  }
                </p>
                {config.last_sync_error && (
                  <p className="text-xs text-destructive mt-1 max-w-md">
                    {config.last_sync_error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSyncNow}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
                {config.last_sync_error && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                    Reconectar
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Como funciona</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Respostas de clientes aos e-mails enviados pelo CRM são sincronizadas automaticamente</li>
                <li>As respostas aparecem no histórico de e-mails de cada oportunidade</li>
                <li>Você recebe uma notificação em tempo real quando um cliente responde</li>
                <li>A sincronização automática ocorre a cada 5 minutos</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
