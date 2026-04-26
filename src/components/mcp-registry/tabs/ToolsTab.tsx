import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Plus, Wrench, Pencil, Power, PowerOff } from 'lucide-react';
import {
  useCreateMcpTool,
  useMcpServers,
  useMcpTools,
  useToggleMcpTool,
  useUpdateMcpTool,
} from '@/hooks/useMcpRegistry';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { MCPRiskBadge } from '../MCPRiskBadge';
import { MCPScopeBadge } from '../MCPScopeBadge';
import { MCPStatusBadge } from '../MCPStatusBadge';
import { MCPExecutionModeBadge } from '../MCPExecutionModeBadge';
import { MCPEmptyState } from '../MCPEmptyState';
import { MCPToolForm } from '../forms/MCPToolForm';
import {
  EXECUTION_MODES,
  RISK_LEVELS,
  type McpTool,
} from '@/services/mcp-registry/types';
import type { CreateMcpToolInput } from '@/services/mcp-registry/mcpRegistryService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  canEditGlobal: boolean;
}

export function ToolsTab({ canEditGlobal }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const [filters, setFilters] = useState({
    server_id: 'all',
    execution_mode: 'all',
    risk_level: 'all',
    is_enabled: 'all' as 'all' | 'true' | 'false',
    requires_approval: 'all' as 'all' | 'true' | 'false',
    scope: 'all' as 'all' | 'global' | 'org',
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<McpTool | null>(null);

  const { data: tools, isLoading } = useMcpTools(filters);
  const { data: servers } = useMcpServers();
  const create = useCreateMcpTool();
  const update = useUpdateMcpTool();
  const toggle = useToggleMcpTool();

  const saving = create.isPending || update.isPending;
  const list = useMemo(() => tools ?? [], [tools]);
  const serversById = useMemo(() => Object.fromEntries((servers ?? []).map((s) => [s.id, s])), [servers]);

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (t: McpTool) => {
    if (t.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    setEditing(t);
    setOpen(true);
  };
  const handleSubmit = async (data: CreateMcpToolInput) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: data });
      else await create.mutateAsync(data);
      toast.success(editing ? 'Tool atualizada.' : 'Tool criada (desabilitada por padrão).');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };
  const handleToggle = async (t: McpTool, enabled: boolean) => {
    if (t.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    try {
      await toggle.mutateAsync({ id: t.id, enabled });
      toast.success(enabled ? 'Tool habilitada.' : 'Tool desabilitada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Select value={filters.server_id} onValueChange={(v) => setFilters((f) => ({ ...f, server_id: v }))}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Servidor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos servidores</SelectItem>
              {(servers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.execution_mode} onValueChange={(v) => setFilters((f) => ({ ...f, execution_mode: v }))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Modo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos modos</SelectItem>
              {EXECUTION_MODES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.risk_level} onValueChange={(v) => setFilters((f) => ({ ...f, risk_level: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos riscos</SelectItem>
              {RISK_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.is_enabled} onValueChange={(v) => setFilters((f) => ({ ...f, is_enabled: v as 'all' | 'true' | 'false' }))}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Habilitada" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="true">Habilitadas</SelectItem>
              <SelectItem value="false">Desabilitadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.requires_approval} onValueChange={(v) => setFilters((f) => ({ ...f, requires_approval: v as 'all' | 'true' | 'false' }))}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Aprovação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas aprovações</SelectItem>
              <SelectItem value="true">Requer aprovação</SelectItem>
              <SelectItem value="false">Sem aprovação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.scope} onValueChange={(v) => setFilters((f) => ({ ...f, scope: v as 'all' | 'global' | 'org' }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Escopo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos escopos</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="org">Organização</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova tool
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <MCPEmptyState
          title="Nenhuma tool MCP cadastrada"
          description="Tools são as ações que agentes poderão invocar (sob aprovação). Comece criando uma tool em um servidor existente."
          icon={Wrench}
          action={<Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Nova tool</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Servidor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Aprovação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => {
                const isGlobal = t.organization_id === null;
                const lockedForUser = isGlobal && !canEditGlobal;
                const server = t.server_id ? serversById[t.server_id] : null;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{t.slug}</TableCell>
                    <TableCell className="text-xs">{server?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.category ?? '—'}</TableCell>
                    <TableCell><MCPExecutionModeBadge mode={t.execution_mode} /></TableCell>
                    <TableCell><MCPRiskBadge risk={t.risk_level} /></TableCell>
                    <TableCell>
                      {t.requires_approval ? (
                        <Badge variant="outline" className="text-xs">Sim</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell><MCPStatusBadge status={t.is_enabled ? 'enabled' : 'disabled'} /></TableCell>
                    <TableCell><MCPScopeBadge orgId={t.organization_id} currentOrgId={orgId} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(t)} disabled={lockedForUser}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            {lockedForUser ? 'Editar (bloqueado)' : 'Editar'}
                          </DropdownMenuItem>
                          {t.is_enabled ? (
                            <DropdownMenuItem onClick={() => handleToggle(t, false)} disabled={lockedForUser}>
                              <PowerOff className="h-3.5 w-3.5 mr-2" /> Desabilitar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleToggle(t, true)} disabled={lockedForUser}>
                              <Power className="h-3.5 w-3.5 mr-2" /> Habilitar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <MCPToolForm
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        servers={(servers ?? []).filter((s) => s.organization_id === orgId)}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}
