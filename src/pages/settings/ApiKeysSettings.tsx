import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, Shield, Clock, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export default function ApiKeysSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        body: { action: 'list' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.data || []) as ApiKey[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        body: { action: 'create', name, scopes: [] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key criada com sucesso' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao criar API Key', description: err.message, variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        body: { action: 'revoke', id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key revogada' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        body: { action: 'delete', id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key excluída' });
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    createMutation.mutate(newKeyName.trim());
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copiado para a área de transferência' });
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewKeyName('');
    setGeneratedKey(null);
    setCopied(false);
  };

  const activeKeys = keys.filter((k) => k.active);
  const inactiveKeys = keys.filter((k) => !k.active);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Key className="h-8 w-8 text-primary" />
              API Keys
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as chaves de acesso para integração com sistemas externos como o Human ERP
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); else setCreateOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar nova API Key</DialogTitle>
                <DialogDescription>
                  A chave será exibida apenas uma vez. Guarde-a em local seguro.
                </DialogDescription>
              </DialogHeader>

              {!generatedKey ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Nome da chave</Label>
                    <Input
                      id="key-name"
                      placeholder="Ex: Human ERP - Produção"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreate}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={!newKeyName.trim() || createMutation.isPending}>
                      {createMutation.isPending ? 'Gerando...' : 'Gerar chave'}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Sua nova API Key:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-background p-2 rounded border font-mono break-all">
                        {generatedKey}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => handleCopy(generatedKey)}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ Esta chave não será exibida novamente. Copie e guarde-a agora.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreate}>Fechar</Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Documentation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Como usar a API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use o header <code className="bg-muted px-1 py-0.5 rounded text-xs">X-API-Key</code> para autenticar suas requisições.
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-xs block whitespace-pre">{`curl -X POST \\
  ${window.location.origin.replace('localhost:8080', 'urihdqturaebhiefwjnw.supabase.co')}/functions/v1/api-products?action=list \\
  -H "X-API-Key: noid_xxxxx..." \\
  -H "Content-Type: application/json"`}</code>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">GET</Badge>
                <span className="text-muted-foreground"><code className="text-xs">?action=list</code> — Lista produtos</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">GET</Badge>
                <span className="text-muted-foreground"><code className="text-xs">?action=get&id=xxx</code> — Busca produto</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0">POST</Badge>
                <span className="text-muted-foreground"><code className="text-xs">action: upsert</code> — Cria/atualiza produto</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0">POST</Badge>
                <span className="text-muted-foreground"><code className="text-xs">action: bulk_upsert</code> — Upsert em lote</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chaves ativas ({activeKeys.length})</CardTitle>
            <CardDescription>API keys com acesso ao sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : activeKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma API key ativa. Crie uma para começar a integração.</p>
            ) : (
              <div className="space-y-3">
                {activeKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{key.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {key.key_prefix}...
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Criada em {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        {key.last_used_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Último uso: {format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {key.expires_at && (
                          <span>Expira em {format(new Date(key.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          Revogar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            A chave "{key.name}" será desativada e não poderá mais ser usada para autenticação. 
                            Sistemas que utilizam esta chave perderão acesso imediatamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revokeMutation.mutate(key.id)}>
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Keys */}
        {inactiveKeys.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Chaves revogadas ({inactiveKeys.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inactiveKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm line-through">{key.name}</span>
                      <Badge variant="destructive" className="text-xs">Revogada</Badge>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja excluir permanentemente esta chave?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(key.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
