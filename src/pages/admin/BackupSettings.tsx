import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  Download, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  HardDrive,
  Calendar,
  Shield,
  Loader2,
  Play
} from 'lucide-react';
import { useBackupHistory } from '@/hooks/useBackupHistory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function BackupSettings() {
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [includeSchema, setIncludeSchema] = useState(true);
  const [exportFormat, setExportFormat] = useState<'json' | 'sql'>('json');
  
  // Fetch organizations for filter
  const { data: organizations = [] } = useQuery({
    queryKey: ['admin-organizations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { 
    backups, 
    stats, 
    isLoading, 
    refetch,
    dataUpdatedAt,
    createBackup, 
    exportBackup,
    exportFullBackup,
    isCreatingBackup,
    isExporting,
    isExportingFull,
  } = useBackupHistory({ 
    organizationId: selectedOrg === 'all' ? undefined : selectedOrg,
    limit: 100 
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Lista atualizada', {
        description: `${backups.length} backup(s) encontrado(s)`,
      });
    } catch (error) {
      toast.error('Erro ao atualizar lista');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateBackup = () => {
    if (selectedOrg && selectedOrg !== 'all') {
      createBackup(selectedOrg);
    }
  };

  const handleExportBackup = () => {
    if (selectedOrg && selectedOrg !== 'all') {
      exportBackup({ orgId: selectedOrg, includeDeleted });
    }
  };

  const handleExportFullBackup = () => {
    if (selectedOrg && selectedOrg !== 'all') {
      exportFullBackup({ 
        orgId: selectedOrg, 
        includeDeleted, 
        includeSchema, 
        format: exportFormat 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      case 'in_progress':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Em progresso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBackupTypeBadge = (type: string) => {
    switch (type) {
      case 'daily':
        return <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" /> Diário</Badge>;
      case 'manual':
        return <Badge variant="outline"><Play className="h-3 w-3 mr-1" /> Manual</Badge>;
      case 'export':
        return <Badge variant="outline"><Download className="h-3 w-3 mr-1" /> Export</Badge>;
      case 'before_delete':
        return <Badge variant="outline"><Shield className="h-3 w-3 mr-1" /> Pré-Delete</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backup & Recovery</h1>
          <p className="text-muted-foreground">
            Gerenciamento de backups automáticos e manuais
          </p>
          {dataUpdatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização: {format(new Date(dataUpdatedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Backups</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último Backup</p>
                <p className="text-sm font-medium">
                  {stats.lastBackup 
                    ? formatDistanceToNow(new Date(stats.lastBackup), { addSuffix: true, locale: ptBR })
                    : 'Nunca'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="actions">Ações</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Backups</CardTitle>
                  <CardDescription>Lista de todos os backups realizados</CardDescription>
                </div>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filtrar por organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as organizações</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum backup encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backups.map((backup) => (
                      <div 
                        key={backup.id} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            <Database className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {getBackupTypeBadge(backup.backup_type)}
                              {getStatusBadge(backup.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(backup.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            {backup.entities_count && (
                              <div className="text-xs text-muted-foreground space-x-2">
                                {Object.entries(backup.entities_count).map(([key, value]) => (
                                  <span key={key} className="inline-block">
                                    {key}: <strong>{value}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                            {backup.completed_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Duração: {Math.round((new Date(backup.completed_at).getTime() - new Date(backup.created_at).getTime()) / 1000)}s
                              </p>
                            )}
                          </div>
                          {backup.status === 'completed' && backup.organization_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exportBackup({ orgId: backup.organization_id!, includeDeleted: false })}
                              disabled={isExporting}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Manual Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Backup Manual
                </CardTitle>
                <CardDescription>
                  Criar um snapshot imediato de todos os dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" disabled>Selecione uma organização</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleCreateBackup}
                  disabled={!selectedOrg || selectedOrg === 'all' || isCreatingBackup}
                  className="w-full"
                >
                  {isCreatingBackup ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando backup...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Criar Backup Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Export Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Exportar Dados
                </CardTitle>
                <CardDescription>
                  Baixar backup simples em formato JSON
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" disabled>Selecione uma organização</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-deleted" 
                    checked={includeDeleted}
                    onCheckedChange={(checked) => setIncludeDeleted(checked as boolean)}
                  />
                  <Label htmlFor="include-deleted" className="text-sm">
                    Incluir itens deletados (soft delete)
                  </Label>
                </div>
                <Button 
                  variant="outline"
                  onClick={handleExportBackup}
                  disabled={!selectedOrg || selectedOrg === 'all' || isExporting}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar JSON
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Full Portable Backup */}
            <Card className="md:col-span-2 border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  Backup Completo Portável
                </CardTitle>
                <CardDescription>
                  Exportar backup completo com schema e dados. <strong>Pode ser restaurado em outro Supabase.</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma organização" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" disabled>Selecione uma organização</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'json' | 'sql')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Formato de exportação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (dados estruturados)</SelectItem>
                      <SelectItem value="sql">SQL (script executável)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-schema" 
                      checked={includeSchema}
                      onCheckedChange={(checked) => setIncludeSchema(checked as boolean)}
                    />
                    <Label htmlFor="include-schema" className="text-sm">
                      Incluir schema (DDL)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-deleted-full" 
                      checked={includeDeleted}
                      onCheckedChange={(checked) => setIncludeDeleted(checked as boolean)}
                    />
                    <Label htmlFor="include-deleted-full" className="text-sm">
                      Incluir itens deletados
                    </Label>
                  </div>
                </div>

                <Button 
                  onClick={handleExportFullBackup}
                  disabled={!selectedOrg || selectedOrg === 'all' || isExportingFull}
                  className="w-full"
                >
                  {isExportingFull ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando backup completo...
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-4 w-4 mr-2" />
                      Exportar Backup Completo ({exportFormat.toUpperCase()})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configurações de Backup Automático
              </CardTitle>
              <CardDescription>
                Configurações do cron job de backup diário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-medium">Backup Diário</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Ativo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Executado automaticamente todos os dias às 03:00 UTC
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Retenção de Dados</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">90 dias</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Snapshots expiram automaticamente após 90 dias
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Rate Limiting</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">10 deleções / 5 min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Limite de exclusões por usuário para evitar perda acidental
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Alertas de Deleção</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Ativo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Admins são notificados sobre deleções críticas em tempo real
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Entidades Protegidas</h4>
                <div className="flex flex-wrap gap-2">
                  {['Oportunidades', 'Propostas', 'Empresas', 'Contatos', 'Atividades', 'Contratos'].map((entity) => (
                    <Badge key={entity} variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {entity}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
