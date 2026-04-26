import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MCPAuditActionBadge } from '../badges/MCPAuditActionBadge';
import { MCPAuditEntityBadge } from '../badges/MCPAuditEntityBadge';
import type { McpAuditLog } from '@/services/mcp-registry/types';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  rows: McpAuditLog[];
  agents: AgentLite[];
  users: UserLite[];
  onRowClick: (r: McpAuditLog) => void;
}

function ShortId({ id }: { id: string | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {id.slice(0, 8)}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(id); toast.success('ID copiado'); }}
        className="text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

export function MCPAuditLogTable({ rows, agents, users, onRowClick }: Props) {
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const userMap = new Map(users.map((u) => [u.user_id, u.full_name ?? u.user_id.slice(0, 8)]));
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Agente</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>Origem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const md = r.metadata ?? {};
            const source = (md.source as string | undefined) ?? '';
            const area = (md.area as string | undefined) ?? '';
            const sprint = (md.sprint as string | undefined) ?? '';
            return (
              <TableRow key={r.id} onClick={() => onRowClick(r)} className="cursor-pointer hover:bg-muted/40">
                <TableCell className="whitespace-nowrap text-xs">
                  {format(new Date(r.created_at), 'dd/MM HH:mm:ss')}
                </TableCell>
                <TableCell><MCPAuditEntityBadge entityType={r.entity_type} /></TableCell>
                <TableCell><MCPAuditActionBadge action={r.action} /></TableCell>
                <TableCell className="text-sm">
                  {r.user_id ? (userMap.get(r.user_id) ?? <ShortId id={r.user_id} />) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {r.agent_id ? (agentMap.get(r.agent_id) ?? <ShortId id={r.agent_id} />) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><ShortId id={r.entity_id} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[source, area, sprint].filter(Boolean).join(' · ') || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
