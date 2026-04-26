import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import type { AuditLogFilters } from '@/services/mcp-registry/mcpAuditService';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  filters: AuditLogFilters;
  onChange: (f: AuditLogFilters) => void;
  agents: AgentLite[];
  users: UserLite[];
}

const ENTITY_TYPES = [
  'all',
  'mcp_server',
  'mcp_tool',
  'mcp_resource',
  'mcp_prompt',
  'mcp_permission',
  'mcp_invocation',
  'mcp_registry_settings',
];

const ACTIONS = [
  'all',
  'created',
  'updated',
  'enabled',
  'disabled',
  'activated',
  'deactivated',
  'archived',
  'system_seed_created',
  'system_seed_verified',
  'simulated_invocation_created',
  'blocked_invocation',
];

export function MCPAuditLogFilters({ filters, onChange, agents, users }: Props) {
  const set = (patch: Partial<AuditLogFilters>) => onChange({ ...filters, ...patch });
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

      <SelectField label="Entidade" value={filters.entity_type ?? 'all'}
        onValueChange={(v) => set({ entity_type: v })}
        options={ENTITY_TYPES.map((v) => ({ value: v, label: v === 'all' ? 'Todas' : v }))} />

      <SelectField label="Ação" value={filters.action ?? 'all'}
        onValueChange={(v) => set({ action: v })}
        options={ACTIONS.map((v) => ({ value: v, label: v === 'all' ? 'Todas' : v }))} />

      <SelectField label="Usuário" value={filters.user_id ?? 'all'}
        onValueChange={(v) => set({ user_id: v })}
        options={[{ value: 'all', label: 'Todos' }, ...users.map((u) => ({ value: u.user_id, label: u.full_name ?? u.user_id.slice(0, 8) }))]} />

      <SelectField label="Agente" value={filters.agent_id ?? 'all'}
        onValueChange={(v) => set({ agent_id: v })}
        options={[{ value: 'all', label: 'Todos' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />

      <div className="space-y-1">
        <Label className="text-xs">Sprint</Label>
        <Input className="h-9 w-24" value={filters.sprint ?? ''} onChange={(e) => set({ sprint: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Source</Label>
        <Input className="h-9 w-32" value={filters.source ?? ''} onChange={(e) => set({ source: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Area</Label>
        <Input className="h-9 w-32" value={filters.area ?? ''} onChange={(e) => set({ area: e.target.value || undefined })} />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="gap-1 h-9">
          <X className="h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  );
}

function SelectField({ label, value, onValueChange, options }: {
  label: string; value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
