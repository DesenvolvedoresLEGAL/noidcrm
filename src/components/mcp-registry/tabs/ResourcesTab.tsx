import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Database, Pencil, Power, PowerOff } from 'lucide-react';
import {
  useCreateMcpResource,
  useMcpResources,
  useMcpServers,
  useToggleMcpResource,
  useUpdateMcpResource,
} from '@/hooks/useMcpRegistry';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { MCPRiskBadge } from '../MCPRiskBadge';
import { MCPScopeBadge } from '../MCPScopeBadge';
import { MCPStatusBadge } from '../MCPStatusBadge';
import { MCPEmptyState } from '../MCPEmptyState';
import { MCPResourceForm } from '../forms/MCPResourceForm';
import {
  READ_SCOPES,
  RESOURCE_TYPES,
  RISK_LEVELS,
  type McpResource,
} from '@/services/mcp-registry/types';
import type { CreateMcpResourceInput } from '@/services/mcp-registry/mcpRegistryService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  canEditGlobal: boolean;
}

export function ResourcesTab({ canEditGlobal }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const [filters, setFilters] = useState({
    resource_type: 'all',
    read_scope: 'all',
    risk_level: 'all',
    is_enabled: 'all' as 'all' | 'true' | 'false',
    scope: 'all' as 'all' | 'global' | 'org',
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<McpResource | null>(null);

  const { data: resources, isLoading } = useMcpResources(filters);
  const { data: servers } = useMcpServers();
  const create = useCreateMcpResource();
  const update = useUpdateMcpResource();
  const toggle = useToggleMcpResource();
  const saving = create.isPending || update.isPending;
  const list = useMemo(() => resources ?? [], [resources]);

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (r: McpResource) => {
    if (r.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    setEditing(r);
    setOpen(true);
  };
  const handleSubmit = async (data: CreateMcpResourceInput) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: data });
      else await create.mutateAsync(data);
      toast.success(editing ? 'Resource atualizado.' : 'Resource criado (desabilitado por padrão).');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };
  const handleToggle = async (r: McpResource, enabled: boolean) => {
    if (r.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    try {
      await toggle.mutateAsync({ id: r.id, enabled });
      toast.success(enabled ? 'Resource habilitado.' : 'Resource desabilitado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Select value={filters.resource_type} onValueChange={(v) => setFilters((f) => ({ ...f, resource_type: v }))}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {RESOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.read_scope} onValueChange={(v) => setFilters((f) => ({ ...f, read_scope: v }))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Read scope" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos escopos</SelectItem>
              {READ_SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Habilitados</SelectItem>
              <SelectItem value="false">Desabilitados</SelectItem>
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
              <Plus className="h-4 w-4" /> Novo resource
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <MCPEmptyState
          title="Nenhum resource MCP cadastrado"
          description="Resources são fontes de contexto (CRM, propostas, atividades) que agentes poderão consultar."
          icon={Database}
          action={<Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Novo resource</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URI Pattern</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Escopo de leitura</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => {
                const isGlobal = r.organization_id === null;
                const lockedForUser = isGlobal && !canEditGlobal;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.uri_pattern}</TableCell>
                    <TableCell className="text-xs">{r.resource_type}</TableCell>
                    <TableCell className="text-xs">{r.read_scope}</TableCell>
                    <TableCell><MCPRiskBadge risk={r.risk_level} /></TableCell>
                    <TableCell><MCPStatusBadge status={r.is_enabled ? 'enabled' : 'disabled'} /></TableCell>
                    <TableCell><MCPScopeBadge orgId={r.organization_id} currentOrgId={orgId} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(r)} disabled={lockedForUser}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            {lockedForUser ? 'Editar (bloqueado)' : 'Editar'}
                          </DropdownMenuItem>
                          {r.is_enabled ? (
                            <DropdownMenuItem onClick={() => handleToggle(r, false)} disabled={lockedForUser}>
                              <PowerOff className="h-3.5 w-3.5 mr-2" /> Desabilitar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleToggle(r, true)} disabled={lockedForUser}>
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

      <MCPResourceForm
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
