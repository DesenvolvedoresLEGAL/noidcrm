import { Badge } from '@/components/ui/badge';
import { Server, Wrench, Database, FileText, Shield, Settings, Activity } from 'lucide-react';

const MAP: Record<string, { label: string; Icon: typeof Server }> = {
  mcp_server: { label: 'Server', Icon: Server },
  mcp_tool: { label: 'Tool', Icon: Wrench },
  mcp_resource: { label: 'Resource', Icon: Database },
  mcp_prompt: { label: 'Prompt', Icon: FileText },
  mcp_permission: { label: 'Permission', Icon: Shield },
  mcp_registry_settings: { label: 'Settings', Icon: Settings },
  mcp_invocation: { label: 'Invocation', Icon: Activity },
};

export function MCPAuditEntityBadge({ entityType }: { entityType: string }) {
  const cfg = MAP[entityType] ?? { label: entityType, Icon: Activity };
  return (
    <Badge variant="outline" className="gap-1">
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
