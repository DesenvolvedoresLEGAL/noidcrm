import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { McpPermissionFilters } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  filters: McpPermissionFilters;
  onChange: (next: McpPermissionFilters) => void;
}

const triBool = [
  { v: 'all', l: 'Todos' },
  { v: 'true', l: 'Sim' },
  { v: 'false', l: 'Não' },
];

export function MCPPermissionFilters({ filters, onChange }: Props) {
  const update = <K extends keyof McpPermissionFilters>(k: K, v: McpPermissionFilters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => update('status', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
            <SelectItem value="archived">Arquivada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tipo de alvo</Label>
        <Select value={filters.target_type ?? 'all'} onValueChange={(v) => update('target_type', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="role">Role</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tipo de objeto</Label>
        <Select value={filters.object_type ?? 'all'} onValueChange={(v) => update('object_type', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="tool">Tool</SelectItem>
            <SelectItem value="resource">Resource</SelectItem>
            <SelectItem value="prompt">Prompt</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Requer aprovação</Label>
        <Select value={filters.requires_approval ?? 'all'} onValueChange={(v) => update('requires_approval', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {triBool.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Can read</Label>
        <Select value={filters.can_read ?? 'all'} onValueChange={(v) => update('can_read', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{triBool.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Can suggest</Label>
        <Select value={filters.can_suggest ?? 'all'} onValueChange={(v) => update('can_suggest', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{triBool.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Can execute</Label>
        <Select value={filters.can_execute ?? 'all'} onValueChange={(v) => update('can_execute', v as never)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{triBool.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
