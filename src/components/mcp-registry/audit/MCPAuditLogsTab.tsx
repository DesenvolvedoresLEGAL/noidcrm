import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMcpAuditLogs, useMcpAuditMetrics, useAiAgentsForPermissions, useUsersForPermissions } from '@/hooks/useMcpRegistry';
import { MCPAuditLogSummaryCards } from './MCPAuditLogSummaryCards';
import { MCPAuditLogFilters } from './MCPAuditLogFilters';
import { MCPAuditLogTable } from './MCPAuditLogTable';
import { MCPAuditLogDrawer } from './MCPAuditLogDrawer';
import { MCPEmptyState } from '../MCPEmptyState';
import type { AuditLogFilters } from '@/services/mcp-registry/mcpAuditService';
import type { McpAuditLog } from '@/services/mcp-registry/types';

export function MCPAuditLogsTab() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [selected, setSelected] = useState<McpAuditLog | null>(null);

  const { data: logs = [], isLoading } = useMcpAuditLogs(filters);
  const { data: metrics } = useMcpAuditMetrics();
  const { data: agents = [] } = useAiAgentsForPermissions();
  const { data: users = [] } = useUsersForPermissions();

  return (
    <div className="space-y-6">
      <MCPAuditLogSummaryCards metrics={metrics} loading={!metrics} />

      <MCPAuditLogFilters filters={filters} onChange={setFilters} agents={agents} users={users} />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : logs.length === 0 ? (
        <MCPEmptyState
          title="Nenhum audit log encontrado"
          description="Eventos do MCP Registry aparecerão aqui conforme alterações forem realizadas."
        />
      ) : (
        <MCPAuditLogTable rows={logs} agents={agents} users={users} onRowClick={(r) => setSelected(r)} />
      )}

      <MCPAuditLogDrawer log={selected} agents={agents} users={users} onClose={() => setSelected(null)} />
    </div>
  );
}
