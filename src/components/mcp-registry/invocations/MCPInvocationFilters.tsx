import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useMcpToolsForInvocation } from '@/hooks/useMcpRegistry';
import type { InvocationFilters } from '@/services/mcp-registry/mcpInvocationsService';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  filters: InvocationFilters;
  onChange: (f: InvocationFilters) => void;
  agents: AgentLite[];
  users: UserLite[];
}

export function MCPInvocationFilters({ filters, onChange, agents, users }: Props) {
  const { data: tools = [] } = useMcpToolsForInvocation();

  const set = (patch: Partial<InvocationFilters>) => onChange({ ...filters, ...patch });
  const clear = () => onChange({});

  const hasFilters = Object.values(filters).some((v) => v && v !== 'all');

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          className="h-9 w-36"
          value={filters.date_from?.slice(0, 10) ?? ''}
          onChange={(e) => set({ date_from: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          className="h-9 w-36"
          value={filters.date_to?.slice(0, 10) ?? ''}
          onChange={(e) => set({ date_to: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })}
        />
      </div>

      <FilterSelect label="Tool" value={filters.tool_id ?? 'all'} onValueChange={(v) => set({ tool_id: v })}
        options={[{ value: 'all', label: 'Todas' }, ...tools.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))]} />

      <FilterSelect label="Tipo" value={filters.invocation_type ?? 'all'}
        onValueChange={(v) => set({ invocation_type: v as InvocationFilters['invocation_type'] })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'simulated', label: 'Simulada' },
          { value: 'real', label: 'Real' },
        ]} />

      <FilterSelect label="Risco" value={filters.risk_level ?? 'all'}
        onValueChange={(v) => set({ risk_level: v as InvocationFilters['risk_level'] })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ]} />

      <FilterSelect label="Modo" value={filters.execution_mode ?? 'all'}
        onValueChange={(v) => set({ execution_mode: v as InvocationFilters['execution_mode'] })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'read_only', label: 'Read-only' },
          { value: 'suggestion_only', label: 'Suggestion' },
          { value: 'approval_required', label: 'Approval' },
          { value: 'automatic_controlled', label: 'Automatic' },
        ]} />

      <FilterSelect label="Aprovação" value={filters.approval_status ?? 'all'}
        onValueChange={(v) => set({ approval_status: v as InvocationFilters['approval_status'] })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'not_required', label: 'N/A' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'expired', label: 'Expired' },
        ]} />

      <FilterSelect label="Status" value={filters.execution_status ?? 'all'}
        onValueChange={(v) => set({ execution_status: v as InvocationFilters['execution_status'] })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'pending', label: 'Pending' },
          { value: 'running', label: 'Running' },
          { value: 'success', label: 'Success' },
          { value: 'failed', label: 'Failed' },
          { value: 'blocked', label: 'Blocked' },
          { value: 'cancelled', label: 'Cancelled' },
        ]} />

      <FilterSelect label="Agente" value={filters.agent_id ?? 'all'}
        onValueChange={(v) => set({ agent_id: v })}
        options={[{ value: 'all', label: 'Todos' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />

      <FilterSelect label="Usuário" value={filters.user_id ?? 'all'}
        onValueChange={(v) => set({ user_id: v })}
        options={[{ value: 'all', label: 'Todos' }, ...users.map((u) => ({ value: u.user_id, label: u.full_name ?? u.user_id.slice(0, 8) }))]} />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="gap-1 h-9">
          <X className="h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
