import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useMcpPermissions,
  useMcpTools,
  useMcpResources,
  useMcpPrompts,
  useAiAgentsForPermissions,
  useUsersForPermissions,
  useSetMcpPermissionStatus,
  useArchiveMcpPermission,
} from '@/hooks/useMcpRegistry';
import { MCPPermissionSummaryCards } from '../permissions/MCPPermissionSummaryCards';
import { MCPPermissionFilters } from '../permissions/MCPPermissionFilters';
import { MCPPermissionTable } from '../permissions/MCPPermissionTable';
import { MCPPermissionForm } from '../permissions/MCPPermissionForm';
import { MCPPermissionTestPanel } from '../permissions/MCPPermissionTestPanel';
import type { McpPermission } from '@/services/mcp-registry/types';
import type { McpPermissionFilters as Filters } from '@/services/mcp-registry/mcpPermissionsService';

export function PermissionsTab() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<McpPermission | null>(null);

  const { data: perms = [], isLoading } = useMcpPermissions(filters);
  const { data: tools = [] } = useMcpTools();
  const { data: resources = [] } = useMcpResources();
  const { data: prompts = [] } = useMcpPrompts();
  const { data: agents = [] } = useAiAgentsForPermissions();
  const { data: users = [] } = useUsersForPermissions();

  const setStatusMut = useSetMcpPermissionStatus();
  const archiveMut = useArchiveMcpPermission();

  const onActivate = async (id: string) => {
    try {
      await setStatusMut.mutateAsync({ id, status: 'active' });
      toast({ title: 'Permissão ativada' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };
  const onDeactivate = async (id: string) => {
    try {
      await setStatusMut.mutateAsync({ id, status: 'inactive' });
      toast({ title: 'Permissão desativada' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };
  const onArchive = async (id: string) => {
    try {
      await archiveMut.mutateAsync(id);
      toast({ title: 'Permissão arquivada' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões MCP
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Controle quais agentes, usuários e papéis podem ler, sugerir ou executar tools, resources e prompts do NOID Intelligence.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova permissão
        </Button>
      </div>

      <MCPPermissionSummaryCards />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <MCPPermissionFilters filters={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : perms.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Nenhuma permissão MCP criada</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Crie a primeira permissão para controlar o que agentes, usuários ou papéis poderão acessar.
              </p>
              <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Criar permissão
              </Button>
            </div>
          ) : (
            <MCPPermissionTable
              permissions={perms}
              tools={tools} resources={resources} prompts={prompts}
              agents={agents} users={users}
              onEdit={(p) => { setEditing(p); setFormOpen(true); }}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onArchive={onArchive}
            />
          )}
        </CardContent>
      </Card>

      <MCPPermissionTestPanel />

      <MCPPermissionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        permission={editing}
      />
    </div>
  );
}
