import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Mail, RefreshCw, Trash2, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  getEmailSyncConfig, 
  toggleEmailSync, 
  deleteEmailSyncConfig,
  initiateGmailOAuth,
  syncEmails,
  getSyncLogs 
} from '@/services/crm/sync';
import type { EmailSyncConfig, SyncLog } from '@/services/crm/sync';

export function EmailSyncCard() {
  const [config, setConfig] = useState<EmailSyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const [emailConfig, syncLogs] = await Promise.all([
        getEmailSyncConfig(),
        getSyncLogs('email', 5)
      ]);
      setConfig(emailConfig);
      setLogs(syncLogs);
    } catch (error) {
      console.error('Failed to load email sync config:', error);
      toast.error('Erro ao carregar configuração de email');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await initiateGmailOAuth();
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      toast.error('Erro ao conectar com Gmail');
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleEmailSync(enabled);
      setConfig(prev => prev ? { ...prev, sync_enabled: enabled } : null);
      toast.success(enabled ? 'Sincronização ativada' : 'Sincronização desativada');
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      toast.error('Erro ao alterar sincronização');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncEmails();
      toast.success(`${result.itemsCreated} novas atividades criadas de ${result.itemsProcessed} emails`);
      await loadConfig();
    } catch (error) {
      console.error('Failed to sync emails:', error);
      toast.error('Erro ao sincronizar emails');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar o Gmail? Isso removerá todas as configurações de sincronização.')) {
      return;
    }

    try {
      await deleteEmailSyncConfig();
      setConfig(null);
      toast.success('Gmail desconectado com sucesso');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Erro ao desconectar Gmail');
    }
  };

  if (loading) {
    return <Card><CardContent className="p-6">Carregando...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Sincronização de Email</CardTitle>
          </div>
          {config && (
            <Badge variant={config.sync_enabled ? "default" : "secondary"}>
              {config.sync_enabled ? 'Ativo' : 'Pausado'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Sincronize automaticamente seus emails do Gmail e crie atividades de CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!config ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Gmail para começar a sincronizar emails automaticamente com suas oportunidades.
            </p>
            <Button onClick={handleConnect} className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Conectar Gmail
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{config.email_address}</p>
                <p className="text-xs text-muted-foreground">
                  Última sincronização: {config.last_sync_at ? new Date(config.last_sync_at).toLocaleString('pt-BR') : 'Nunca'}
                </p>
              </div>
              <Switch
                checked={config.sync_enabled}
                onCheckedChange={handleToggle}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={syncing || !config.sync_enabled}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar Agora
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                size="icon"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {logs.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium">Últimas sincronizações</p>
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {log.items_created} criadas / {log.items_processed} processadas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}