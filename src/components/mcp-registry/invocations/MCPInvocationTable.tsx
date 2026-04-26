import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MCPInvocationStatusBadge } from '../badges/MCPInvocationStatusBadge';
import { MCPApprovalStatusBadge } from '../badges/MCPApprovalStatusBadge';
import { MCPInvocationTypeBadge } from '../badges/MCPInvocationTypeBadge';
import { MCPRiskBadge } from '../MCPRiskBadge';
import { MCPExecutionModeBadge } from '../MCPExecutionModeBadge';
import type { McpToolInvocation } from '@/services/mcp-registry/types';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  rows: McpToolInvocation[];
  agents: AgentLite[];
  users: UserLite[];
  onRowClick: (r: McpToolInvocation) => void;
}

function ShortId({ id }: { id: string | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {id.slice(0, 8)}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(id);
          toast.success('ID copiado');
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

export function MCPInvocationTable({ rows, agents, users, onRowClick }: Props) {
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const userMap = new Map(users.map((u) => [u.user_id, u.full_name ?? u.user_id.slice(0, 8)]));

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Agente</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Aprovação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Volts</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              onClick={() => onRowClick(r)}
              className="cursor-pointer hover:bg-muted/40"
            >
              <TableCell className="whitespace-nowrap text-xs">
                {format(new Date(r.created_at), 'dd/MM HH:mm:ss')}
              </TableCell>
              <TableCell className="text-sm">
                <div className="font-medium">{r.tool_slug ?? '—'}</div>
                {r.tool_id && <ShortId id={r.tool_id} />}
              </TableCell>
              <TableCell><MCPInvocationTypeBadge type={r.invocation_type} /></TableCell>
              <TableCell className="text-sm">
                {r.agent_id ? (agentMap.get(r.agent_id) ?? <ShortId id={r.agent_id} />) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-sm">
                {r.user_id ? (userMap.get(r.user_id) ?? <ShortId id={r.user_id} />) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell><MCPRiskBadge risk={r.risk_level} /></TableCell>
              <TableCell>{r.execution_mode ? <MCPExecutionModeBadge mode={r.execution_mode} /> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><MCPApprovalStatusBadge status={r.approval_status} /></TableCell>
              <TableCell><MCPInvocationStatusBadge status={r.execution_status} /></TableCell>
              <TableCell className="text-right text-xs font-mono">{r.volts_consumed}</TableCell>
              <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={r.error_message ?? ''}>
                {r.error_message ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
