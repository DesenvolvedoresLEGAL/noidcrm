import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Bot, Archive, Eye, Pencil, Pause, Play, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAIAgents, useArchiveAIAgent, useUpdateAIAgent } from '@/hooks/useAIAgents';
import { AGENT_STATUS_LABELS, AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS } from '@/types/ai-agents';
import type { AgentStatus, AutonomyLevel, AgentScope } from '@/types/ai-agents';
import type { AIAgentWithRelations } from '@/services/ai-agents/aiAgentsService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<AgentStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  test: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  production: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function AgentsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autonomyFilter, setAutonomyFilter] = useState<string>('all');

  const { data: agents, isLoading } = useAIAgents({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    autonomy_level: autonomyFilter !== 'all' ? autonomyFilter : undefined,
  });

  const archiveMutation = useArchiveAIAgent();
  const updateMutation = useUpdateAIAgent();

  const togglePause = (id: string, currentStatus: AgentStatus) => {
    const newStatus = currentStatus === 'paused' ? 'draft' : 'paused';
    updateMutation.mutate({ id, payload: { status: newStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os agentes inteligentes da sua organização
          </p>
        </div>
        <Button onClick={() => navigate('/app/settings/noid-intelligence/agents/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(AGENT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={autonomyFilter} onValueChange={setAutonomyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Autonomia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas autonomias</SelectItem>
            {Object.entries(AUTONOMY_LEVEL_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum agente criado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Comece estruturando o primeiro agente do NOID Intelligence.
          </p>
          <Button onClick={() => navigate('/app/settings/noid-intelligence/agents/new')} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Criar primeiro agente
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Objetivo</TableHead>
                <TableHead className="hidden lg:table-cell">Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Autonomia</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden xl:table-cell">Versão</TableHead>
                <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(agents as AIAgentWithRelations[]).map((agent) => (
                <TableRow key={agent.id} className="cursor-pointer" onClick={() => navigate(`/app/settings/noid-intelligence/agents/${agent.id}`)}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                    {agent.objective || '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(agent.agent_scope || []).slice(0, 2).map((s: AgentScope) => (
                        <Badge key={s} variant="outline" className="text-xs">{AGENT_SCOPE_LABELS[s] || s}</Badge>
                      ))}
                      {(agent.agent_scope || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">+{agent.agent_scope.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${statusColors[agent.status as AgentStatus] || ''}`}>
                      {AGENT_STATUS_LABELS[agent.status as AgentStatus] || agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {AUTONOMY_LEVEL_LABELS[agent.autonomy_level as AutonomyLevel] || agent.autonomy_level}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {agent.owner_name || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">
                    {agent.active_version_number ? (
                      <Badge variant="outline" className="text-xs">v{agent.active_version_number}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {format(new Date(agent.updated_at), "dd MMM yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">⋮</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/app/settings/noid-intelligence/agents/${agent.id}`)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/app/settings/noid-intelligence/agents/${agent.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePause(agent.id, agent.status as AgentStatus)}>
                          {agent.status === 'paused' ? (
                            <><Play className="h-4 w-4 mr-2" /> Retomar</>
                          ) : (
                            <><Pause className="h-4 w-4 mr-2" /> Pausar</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => archiveMutation.mutate(agent.id)}>
                          <Archive className="h-4 w-4 mr-2" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
