import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MCPRegistryHeader } from '@/components/mcp-registry/MCPRegistryHeader';
import { OverviewTab } from '@/components/mcp-registry/tabs/OverviewTab';
import { ServersTab } from '@/components/mcp-registry/tabs/ServersTab';
import { ToolsTab } from '@/components/mcp-registry/tabs/ToolsTab';
import { ResourcesTab } from '@/components/mcp-registry/tabs/ResourcesTab';
import { PromptsTab } from '@/components/mcp-registry/tabs/PromptsTab';
import { PermissionsTab } from '@/components/mcp-registry/tabs/PermissionsTab';
import { SettingsTab } from '@/components/mcp-registry/tabs/SettingsTab';
import { AccessDenied } from '@/components/AccessDenied';
import { useCanAccessMcpRegistry } from '@/hooks/useMcpRegistry';
import { Skeleton } from '@/components/ui/skeleton';

export default function McpRegistryPage() {
  const { canAccess, canEditGlobal, loading } = useCanAccessMcpRegistry();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <AccessDenied
        title="Acesso restrito"
        description="O MCP Registry é uma configuração técnica do NOID Intelligence. Apenas administradores da organização ou platform admins podem acessar."
      />
    );
  }

  return (
    <div className="space-y-6">
      <MCPRegistryHeader />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="servers"><ServersTab canEditGlobal={canEditGlobal} /></TabsContent>
        <TabsContent value="tools"><ToolsTab canEditGlobal={canEditGlobal} /></TabsContent>
        <TabsContent value="resources"><ResourcesTab canEditGlobal={canEditGlobal} /></TabsContent>
        <TabsContent value="prompts"><PromptsTab canEditGlobal={canEditGlobal} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
