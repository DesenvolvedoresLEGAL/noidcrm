import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ShieldCheck } from 'lucide-react';
import { useMcpInvocations, useMcpInvocationMetrics } from '@/hooks/useMcpRegistry';
import { useAiAgentsForPermissions, useUsersForPermissions } from '@/hooks/useMcpRegistry';
import { MCPInvocationSummaryCards } from './MCPInvocationSummaryCards';
import { MCPInvocationFilters } from './MCPInvocationFilters';
import { MCPInvocationTable } from './MCPInvocationTable';
import { MCPInvocationDetailDrawer } from './MCPInvocationDetailDrawer';
import { MCPSimulatedInvocationForm } from './MCPSimulatedInvocationForm';
import { MCPEmptyState } from '../MCPEmptyState';
import type { InvocationFilters } from '@/services/mcp-registry/mcpInvocationsService';
import type { McpToolInvocation } from '@/services/mcp-registry/types';

export function MCPInvocationsTab() {
  const [filters, setFilters] = useState<InvocationFilters>({});
  const [selected, setSelected] = useState<McpToolInvocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: invocations = [], isLoading } = useMcpInvocations(filters);
  const { data: metrics } = useMcpInvocationMetrics();
  const { data: agents = [] } = useAiAgentsForPermissions();
  const { data: users = [] } = useUsersForPermissions();

  return (
    <div className="space-y-6">
      {/* Banner de segurança */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Ambiente seguro</p>
            <p className="text-muted-foreground">
              As invocations desta fase são apenas <strong>simulações</strong> e não executam ações
              externas. Nenhum dado real do CRM é alterado.
            </p>
          </div>
        </CardContent>
      </Card>

      <MCPInvocationSummaryCards metrics={metrics} loading={!metrics} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <MCPInvocationFilters
          filters={filters}
          onChange={setFilters}
          agents={agents}
          users={users}
        />
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar invocation simulada
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : invocations.length === 0 ? (
        <MCPEmptyState
          title="Nenhuma invocation MCP registrada"
          description="Crie uma simulação controlada para validar permissões e segurança."
          actionLabel="Criar invocation simulada"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <MCPInvocationTable
          rows={invocations}
          agents={agents}
          users={users}
          onRowClick={(r) => setSelected(r)}
        />
      )}

      <MCPInvocationDetailDrawer
        invocation={selected}
        agents={agents}
        users={users}
        onClose={() => setSelected(null)}
      />

      <MCPSimulatedInvocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        agents={agents}
        users={users}
      />
    </div>
  );
}
