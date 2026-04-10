import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, ArrowLeft, Archive, Pencil, Save, X } from 'lucide-react';
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
import { useAIAgent, useUpdateAIAgent, useArchiveAIAgent, useAIAgentVersions, useAIAgentAudit } from '@/hooks/useAIAgents';
import {
  AGENT_STATUS_LABELS, AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS,
} from '@/types/ai-agents';
import type { AgentStatus, AutonomyLevel, AgentScope, UpdateAgentPayload } from '@/types/ai-agents';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const updateMutation = useUpdateAIAgent();
  const archiveMutation = useArchiveAIAgent();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateAgentPayload>({});

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
        </div>
        <div className="flex gap-2">
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
              <Button variant="destructive" size="sm" onClick={handleArchive}><Archive className="h-4 w-4 mr-1" /> Arquivar</Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
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
                      <TableHead>Resumo</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">v{v.version_number}</TableCell>
                        <TableCell>
                          <Badge variant={v.is_active ? 'default' : 'outline'}>
                            {v.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.change_summary || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(v.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
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
    </div>
  );
}
