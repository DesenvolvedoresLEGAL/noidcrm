import { Wrench, Database, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { McpPermission, McpTool, McpResource, McpPrompt } from '@/services/mcp-registry/types';

interface Props {
  permission: McpPermission;
  tool?: McpTool;
  resource?: McpResource;
  prompt?: McpPrompt;
}

export function MCPPermissionObjectBadge({ permission, tool, resource, prompt }: Props) {
  if (permission.tool_id) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <Wrench className="h-3 w-3" />
        Tool · {tool?.slug ?? tool?.name ?? `${permission.tool_id.slice(0, 8)}…`}
      </Badge>
    );
  }
  if (permission.resource_id) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <Database className="h-3 w-3" />
        Resource · {resource?.uri_pattern ?? resource?.name ?? `${permission.resource_id.slice(0, 8)}…`}
      </Badge>
    );
  }
  if (permission.prompt_id) {
    return (
      <Badge variant="outline" className="gap-1 font-medium">
        <FileText className="h-3 w-3" />
        Prompt · {prompt?.slug ?? prompt?.name ?? `${permission.prompt_id.slice(0, 8)}…`}
      </Badge>
    );
  }
  return <Badge variant="secondary">—</Badge>;
}
