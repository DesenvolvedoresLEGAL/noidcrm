import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Archive, Pencil, Save, X, Rocket, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useAIAgent, useUpdateAIAgent, useArchiveAIAgent, useAIAgentVersions, useAIAgentAudit,
  usePublishAgentVersion, usePauseResumeAgent, useAgentPublishHistory,
} from '@/hooks/useAIAgents';
import {
  AGENT_STATUS_LABELS, AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS,
  ENVIRONMENT_LABELS, ENVIRONMENT_COLORS,
} from '@/types/ai-agents';
import type { AgentStatus, AutonomyLevel, AgentScope, AgentEnvironment, UpdateAgentPayload } from '@/types/ai-agents';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PublishModal from '@/components/noid-intelligence/PublishModal';

const statusColors: Record<AgentStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  test: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  production: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const ALL_SCOPES: AgentScope[] = [
  'lead', 'contact', 'account', 'opportunity', 'proposal',
  'activity', 'pipeline', 'forecast', 'playbook', 'external_signal',
];

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useAIAgent(id);
  const { data: versions } = useAIAgentVersions(id);
  const { data: auditLogs } = useAIAgentAudit(id);
  const { data: publishHistory } = useAgentPublishHistory(id);
  const updateMutation = useUpdateAIAgent();
  const archiveMutation = useArchiveAIAgent();
  const publishMutation = usePublishAgentVersion();
  const pauseMutation = usePauseResumeAgent();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateAgentPayload>({});
  const [publishOpen, setPublishOpen] = useState(false);

  const startEdit = () => {
    if (!agent) return;
    setEditData({
      name: agent.name,
      description: agent.description,
      objective: agent.objective,
      status: agent.status,
      autonomy_level: agent.autonomy_level,
      agent_scope: [...agent.agent_scope],
      primary_channel: agent.primary_channel,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    await updateMutation.mutateAsync({ id, payload: editData });
    setEditing(false);
  };

  const handleArchive = async () => {
    if (!id) return;
    await archiveMutation.mutateAsync(id);
    navigate('/app/settings/noid-intelligence/agents');
  };

  const handlePauseResume = async () => {
    if (!id || !agent) return;
    await pauseMutation.mutateAsync({
      agent_id: id,
      action: (agent as any).is_paused ? 'resume' : 'pause',
    });
  };

  const handlePublish = async (versionId: string, environment: string) => {
    if (!id) return;
    await publishMutation.mutateAsync({ agent_id: id, version_id: versionId, environment });
  };

  const toggleScope = (scope: AgentScope) => {
    const current = editData.agent_scope || [];
    setEditData({
      ...editData,
      agent_scope: current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Agente não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/app/settings/noid-intelligence/agents')}>
          Voltar
        </Button>
      </div>
    );
  }

  const activeVersion = versions?.find((v) => v.is_active);
  const agentEnv = (agent as any).environment as AgentEnvironment || 'draft';
  const isPaused = (agent as any).is_paused;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.slug}</p>
          </div>
          <Badge className={statusColors[agent.status as AgentStatus]}>
            {AGENT_STATUS_LABELS[agent.status as AgentStatus]}
          </Badge>
          <Badge className={ENVIRONMENT_COLORS[agentEnv]}>
            {ENVIRONMENT_LABELS[agentEnv]}
          </Badge>
          {isPaused && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              Pausado
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
              <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
              <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>
                <Rocket className="h-4 w-4 mr-1" /> Publicar
              </Button>
              <Button variant="outline" size="sm" onClick={handlePauseResume} disabled={pauseMutation.isPending}>
                {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                {isPaused ? 'Ativar' : 'Pausar'}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleArchive}><Archive className="h-4 w-4 mr-1" /> Arquivar</Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="environment">Ambiente</TabsTrigger>
          <TabsTrigger value="versions">Versões</TabsTrigger>
          <TabsTrigger value="bindings">Vínculos</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {editing ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v as AgentStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(AGENT_STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Textarea value={editData.objective || ''} onChange={(e) => setEditData({ ...editData, objective: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Autonomia</Label>
                  <Select value={editData.autonomy_level} onValueChange={(v) => setEditData({ ...editData, autonomy_level: v as AutonomyLevel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUTONOMY_LEVEL_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SCOPES.map((scope) => (
                      <Badge
                        key={scope}
                        variant={(editData.agent_scope || []).includes(scope) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleScope(scope)}
                      >
                        {AGENT_SCOPE_LABELS[scope]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Canal Principal</Label>
                  <Input value={editData.primary_channel || ''} onChange={(e) => setEditData({ ...editData, primary_channel: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Detalhes</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="text-muted-foreground">Objetivo:</span> <span>{agent.objective || '—'}</span></div>
                  <div><span className="text-muted-foreground">Descrição:</span> <span>{agent.description || '—'}</span></div>
                  <div><span className="text-muted-foreground">Autonomia:</span> <span>{AUTONOMY_LEVEL_LABELS[agent.autonomy_level as AutonomyLevel]}</span></div>
                  <div><span className="text-muted-foreground">Canal:</span> <span>{agent.primary_channel || '—'}</span></div>
                  <div><span className="text-muted-foreground">Versão ativa:</span> <span>{activeVersion ? `v${activeVersion.version_number}` : '—'}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Escopo</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(agent.agent_scope || []).map((s: AgentScope) => (
                      <Badge key={s} variant="outline">{AGENT_SCOPE_LABELS[s] || s}</Badge>
                    ))}
                    {(!agent.agent_scope || agent.agent_scope.length === 0) && (
                      <span className="text-sm text-muted-foreground">Nenhum escopo definido</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Environment Tab */}
        <TabsContent value="environment" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Ambiente Atual</CardTitle></CardHeader>
              <CardContent>
                <Badge className={`text-base px-3 py-1 ${ENVIRONMENT_COLORS[agentEnv]}`}>
                  {ENVIRONMENT_LABELS[agentEnv]}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Status de Execução</CardTitle></CardHeader>
              <CardContent>
                <Badge className={isPaused ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                  {isPaused ? 'Pausado' : 'Ativo'}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Versão Publicada</CardTitle></CardHeader>
              <CardContent>
                <span className="text-lg font-semibold">
                  {activeVersion ? `v${activeVersion.version_number}` : '—'}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Publish history */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Publicação</CardTitle></CardHeader>
            <CardContent>
              {!publishHistory || publishHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma publicação registrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Versão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publishHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={ENVIRONMENT_COLORS[h.environment as AgentEnvironment] || ''}>
                            {ENVIRONMENT_LABELS[h.environment as AgentEnvironment] || h.environment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {versions?.find((v) => v.id === h.version_id)
                            ? `v${versions.find((v) => v.id === h.version_id)!.version_number}`
                            : h.version_id.slice(0, 8)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!versions || versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma versão encontrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Resumo</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">v{v.version_number}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={v.is_active ? 'default' : 'outline'}>
                              {v.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            {v.is_published && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Publicada
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ENVIRONMENT_COLORS[v.environment as AgentEnvironment] || 'bg-muted'}>
                            {ENVIRONMENT_LABELS[v.environment as AgentEnvironment] || v.environment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.change_summary || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(v.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {!v.is_published && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                publishMutation.mutate({ agent_id: agent.id, version_id: v.id, environment: 'production' });
                              }}
                              disabled={publishMutation.isPending}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Publicar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bindings - Placeholder */}
        <TabsContent value="bindings" className="mt-4">
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">Vínculos com entidades do CRM estarão disponíveis em breve.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!auditLogs || auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro de auditoria</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Dados</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.action_type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">
                          {JSON.stringify(log.payload_json)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Publish Modal */}
      <PublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        versions={versions || []}
        currentVersionId={(agent as any).last_published_version_id}
        onPublish={handlePublish}
        isPending={publishMutation.isPending}
      />
    </div>
  );
}
