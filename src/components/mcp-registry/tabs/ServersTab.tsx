import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Plus,
  Server as ServerIcon,
  Pencil,
  Power,
  PowerOff,
  Archive,
} from 'lucide-react';
import {
  useCreateMcpServer,
  useMcpServers,
  useMcpSettings,
  useSetMcpServerStatus,
  useUpdateMcpServer,
} from '@/hooks/useMcpRegistry';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { MCPStatusBadge } from '../MCPStatusBadge';
import { MCPRiskBadge } from '../MCPRiskBadge';
import { MCPScopeBadge } from '../MCPScopeBadge';
import { MCPEmptyState } from '../MCPEmptyState';
import { MCPServerForm } from '../forms/MCPServerForm';
import {
  RISK_LEVELS,
  SERVER_TYPES,
  STATUSES,
  TRANSPORT_TYPES,
  type McpServer,
} from '@/services/mcp-registry/types';
import type { CreateMcpServerInput } from '@/services/mcp-registry/mcpRegistryService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  canEditGlobal: boolean;
}

export function ServersTab({ canEditGlobal }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const [filters, setFilters] = useState({
    status: 'all',
    server_type: 'all',
    transport_type: 'all',
    risk_level: 'all',
    scope: 'all' as 'all' | 'global' | 'org',
  });
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [open, setOpen] = useState(false);

  const { data: servers, isLoading } = useMcpServers(filters);
  const { data: settings } = useMcpSettings();
  const create = useCreateMcpServer();
  const update = useUpdateMcpServer();
  const setStatus = useSetMcpServerStatus();

  const allowExternal = settings?.allow_external_servers ?? false;
  const saving = create.isPending || update.isPending;

  const handleNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const handleEdit = (s: McpServer) => {
    if (s.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    setEditing(s);
    setOpen(true);
  };
  const handleSubmit = async (data: CreateMcpServerInput) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: data });
      else await create.mutateAsync(data);
      toast.success('Servidor salvo.');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  const handleStatus = async (s: McpServer, status: McpServer['status']) => {
    if (s.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    if (status === 'active' && s.server_type === 'external' && !allowExternal) {
      toast.error('Servidores externos estão bloqueados nas configurações MCP desta organização.');
      return;
    }
    try {
      await setStatus.mutateAsync({ id: s.id, status });
      toast.success('Status atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  const list = useMemo(() => servers ?? [], [servers]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.server_type} onValueChange={(v) => setFilters((f) => ({ ...f, server_type: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {SERVER_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.transport_type} onValueChange={(v) => setFilters((f) => ({ ...f, transport_type: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Transporte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos transportes</SelectItem>
              {TRANSPORT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.risk_level} onValueChange={(v) => setFilters((f) => ({ ...f, risk_level: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos riscos</SelectItem>
              {RISK_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
              <Plus className="h-4 w-4" /> Novo servidor
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <MCPEmptyState
          title="Nenhum servidor MCP encontrado"
          description="Crie um servidor para começar a registrar tools e resources."
          icon={ServerIcon}
          action={
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo servidor
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Transporte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const isGlobal = s.organization_id === null;
                const lockedForUser = isGlobal && !canEditGlobal;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{s.slug}</TableCell>
                    <TableCell className="capitalize">{s.server_type}</TableCell>
                    <TableCell className="uppercase text-xs">{s.transport_type}</TableCell>
                    <TableCell><MCPStatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-xs">{s.auth_type}</TableCell>
                    <TableCell><MCPRiskBadge risk={s.risk_level} /></TableCell>
                    <TableCell><MCPScopeBadge orgId={s.organization_id} currentOrgId={orgId} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(s)} disabled={lockedForUser}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            {lockedForUser ? 'Editar (bloqueado)' : 'Editar'}
                          </DropdownMenuItem>
                          {s.status !== 'active' && (
                            <DropdownMenuItem onClick={() => handleStatus(s, 'active')} disabled={lockedForUser}>
                              <Power className="h-3.5 w-3.5 mr-2" /> Ativar
                            </DropdownMenuItem>
                          )}
                          {s.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatus(s, 'inactive')} disabled={lockedForUser}>
                              <PowerOff className="h-3.5 w-3.5 mr-2" /> Desativar
                            </DropdownMenuItem>
                          )}
                          {s.status !== 'archived' && (
                            <DropdownMenuItem onClick={() => handleStatus(s, 'archived')} disabled={lockedForUser}>
                              <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
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

      <MCPServerForm
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        allowExternalServers={allowExternal}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}
