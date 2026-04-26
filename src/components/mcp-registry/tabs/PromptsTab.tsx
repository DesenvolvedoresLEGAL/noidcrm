import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, FileText, Pencil, Power, PowerOff, Archive } from 'lucide-react';
import {
  useCreateMcpPrompt,
  useMcpPrompts,
  useSetMcpPromptStatus,
  useUpdateMcpPrompt,
} from '@/hooks/useMcpRegistry';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { MCPScopeBadge } from '../MCPScopeBadge';
import { MCPStatusBadge } from '../MCPStatusBadge';
import { MCPEmptyState } from '../MCPEmptyState';
import { MCPPromptForm } from '../forms/MCPPromptForm';
import { PROMPT_TYPES, STATUSES, type McpPrompt, type McpStatus } from '@/services/mcp-registry/types';
import type { CreateMcpPromptInput } from '@/services/mcp-registry/mcpRegistryService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  canEditGlobal: boolean;
}

export function PromptsTab({ canEditGlobal }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const [filters, setFilters] = useState({
    prompt_type: 'all',
    status: 'all',
    version: 'all',
    scope: 'all' as 'all' | 'global' | 'org',
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<McpPrompt | null>(null);

  const { data: prompts, isLoading } = useMcpPrompts(filters);
  const create = useCreateMcpPrompt();
  const update = useUpdateMcpPrompt();
  const setStatus = useSetMcpPromptStatus();
  const saving = create.isPending || update.isPending;
  const list = useMemo(() => prompts ?? [], [prompts]);

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (p: McpPrompt) => {
    if (p.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    setEditing(p);
    setOpen(true);
  };
  const handleSubmit = async (data: CreateMcpPromptInput) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: data });
      else await create.mutateAsync(data);
      toast.success(editing ? 'Prompt atualizado.' : 'Prompt criado em rascunho.');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };
  const handleStatus = async (p: McpPrompt, status: McpStatus) => {
    if (p.organization_id === null && !canEditGlobal) {
      toast.error('Item global — somente platform admin pode editar.');
      return;
    }
    try {
      await setStatus.mutateAsync({ id: p.id, status });
      toast.success('Status atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar alteração.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Select value={filters.prompt_type} onValueChange={(v) => setFilters((f) => ({ ...f, prompt_type: v }))}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {PROMPT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
              <Plus className="h-4 w-4" /> Novo prompt
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <MCPEmptyState
          title="Nenhum prompt MCP cadastrado"
          description="Prompts armazenam instruções e templates reutilizáveis pelos agentes. Comece criando um prompt em rascunho."
          icon={FileText}
          action={<Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Novo prompt</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const isGlobal = p.organization_id === null;
                const lockedForUser = isGlobal && !canEditGlobal;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.slug}</TableCell>
                    <TableCell className="text-xs">{p.prompt_type}</TableCell>
                    <TableCell className="text-xs">v{p.version}</TableCell>
                    <TableCell><MCPStatusBadge status={p.status} /></TableCell>
                    <TableCell><MCPScopeBadge orgId={p.organization_id} currentOrgId={orgId} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(p.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(p)} disabled={lockedForUser}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            {lockedForUser ? 'Editar (bloqueado)' : 'Editar'}
                          </DropdownMenuItem>
                          {p.status !== 'active' && (
                            <DropdownMenuItem onClick={() => handleStatus(p, 'active')} disabled={lockedForUser}>
                              <Power className="h-3.5 w-3.5 mr-2" /> Ativar
                            </DropdownMenuItem>
                          )}
                          {p.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatus(p, 'inactive')} disabled={lockedForUser}>
                              <PowerOff className="h-3.5 w-3.5 mr-2" /> Desativar
                            </DropdownMenuItem>
                          )}
                          {p.status !== 'archived' && (
                            <DropdownMenuItem onClick={() => handleStatus(p, 'archived')} disabled={lockedForUser}>
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

      <MCPPromptForm open={open} onOpenChange={setOpen} initial={editing} onSubmit={handleSubmit} saving={saving} />
    </div>
  );
}
