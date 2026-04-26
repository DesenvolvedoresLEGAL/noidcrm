import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Power, PowerOff, Archive } from 'lucide-react';
import type { McpPermission, McpTool, McpResource, McpPrompt } from '@/services/mcp-registry/types';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';
import { MCPPermissionTargetBadge } from './MCPPermissionTargetBadge';
import { MCPPermissionObjectBadge } from './MCPPermissionObjectBadge';
import { MCPPermissionActionBadges } from './MCPPermissionActionBadges';
import { MCPPermissionStatusBadge } from './MCPPermissionStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock } from 'lucide-react';

interface Props {
  permissions: McpPermission[];
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
  agents: AgentLite[];
  users: UserLite[];
  onEdit: (p: McpPermission) => void;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onArchive: (id: string) => void;
}

export function MCPPermissionTable({
  permissions, tools, resources, prompts, agents, users,
  onEdit, onActivate, onDeactivate, onArchive,
}: Props) {
  const toolMap = new Map(tools.map((t) => [t.id, t]));
  const resMap = new Map(resources.map((r) => [r.id, r]));
  const promptMap = new Map(prompts.map((p) => [p.id, p]));
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alvo</TableHead>
            <TableHead>Objeto</TableHead>
            <TableHead>Permissões</TableHead>
            <TableHead>Aprovação</TableHead>
            <TableHead className="text-right">Limite/dia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissions.map((p) => {
            const agent = p.agent_id ? agentMap.get(p.agent_id) : undefined;
            const user = p.user_id ? userMap.get(p.user_id) : undefined;
            const tool = p.tool_id ? toolMap.get(p.tool_id) : undefined;
            const res = p.resource_id ? resMap.get(p.resource_id) : undefined;
            const prompt = p.prompt_id ? promptMap.get(p.prompt_id) : undefined;
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <MCPPermissionTargetBadge permission={p} agentName={agent?.name} userName={user?.full_name ?? undefined} />
                </TableCell>
                <TableCell>
                  <MCPPermissionObjectBadge permission={p} tool={tool} resource={res} prompt={prompt} />
                </TableCell>
                <TableCell>
                  <MCPPermissionActionBadges can_read={p.can_read} can_suggest={p.can_suggest} can_execute={p.can_execute} />
                </TableCell>
                <TableCell>
                  {p.requires_approval ? (
                    <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
                      <Lock className="h-3 w-3" /> Approval
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Unlock className="h-3 w-3" /> No approval
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.max_calls_per_day ?? '—'}
                </TableCell>
                <TableCell>
                  <MCPPermissionStatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(p)}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {p.status !== 'active' && (
                        <DropdownMenuItem onClick={() => onActivate(p.id)}>
                          <Power className="h-4 w-4 mr-2" /> Ativar
                        </DropdownMenuItem>
                      )}
                      {p.status !== 'inactive' && (
                        <DropdownMenuItem onClick={() => onDeactivate(p.id)}>
                          <PowerOff className="h-4 w-4 mr-2" /> Desativar
                        </DropdownMenuItem>
                      )}
                      {p.status !== 'archived' && (
                        <DropdownMenuItem onClick={() => onArchive(p.id)} className="text-destructive">
                          <Archive className="h-4 w-4 mr-2" /> Arquivar
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
    </div>
  );
}
