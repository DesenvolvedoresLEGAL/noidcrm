import { Bot, User, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { McpPermission } from '@/services/mcp-registry/types';

interface Props {
  permission: McpPermission;
  agentName?: string;
  userName?: string;
}

export function MCPPermissionTargetBadge({ permission, agentName, userName }: Props) {
  if (permission.agent_id) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <Bot className="h-3 w-3" />
        Agent: {agentName ?? `${permission.agent_id.slice(0, 8)}…`}
      </Badge>
    );
  }
  if (permission.user_id) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <User className="h-3 w-3" />
        User: {userName ?? `${permission.user_id.slice(0, 8)}…`}
      </Badge>
    );
  }
  if (permission.role_name) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <Shield className="h-3 w-3" />
        Role: {permission.role_name}
      </Badge>
    );
  }
  return <Badge variant="secondary">—</Badge>;
}
