import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from './useCurrentOrganization';
import { usePlatformAdmin } from './usePlatformAdmin';
import {
  createMcpPrompt,
  createMcpResource,
  createMcpServer,
  createMcpSettingsIfMissing,
  createMcpTool,
  getMcpOverviewMetrics,
  getMcpSettings,
  listMcpPrompts,
  listMcpResources,
  listMcpServers,
  listMcpTools,
  setMcpPromptStatus,
  setMcpServerStatus,
  toggleMcpResource,
  toggleMcpTool,
  updateMcpTool,
  updateMcpPrompt,
  updateMcpResource,
  updateMcpServer,
  updateMcpSettings,
  type CreateMcpPromptInput,
  type CreateMcpResourceInput,
  type CreateMcpServerInput,
  type CreateMcpToolInput,
  type PromptFilters,
  type ResourceFilters,
  type ServerFilters,
  type ToolFilters,
  type UpdateMcpPromptInput,
  type UpdateMcpResourceInput,
  type UpdateMcpServerInput,
  type UpdateMcpSettingsInput,
  type UpdateMcpToolInput,
} from '@/services/mcp-registry/mcpRegistryService';
import type { McpStatus, McpPermissionStatus } from '@/services/mcp-registry/types';
import {
  listMcpPermissions,
  createMcpPermission,
  updateMcpPermission,
  setMcpPermissionStatus,
  archiveMcpPermission,
  testMcpPermission,
  getMcpPermissionMetrics,
  listAiAgentsForPermissions,
  listUsersForPermissions,
  type McpPermissionFilters,
  type CreateMcpPermissionInput,
  type UpdateMcpPermissionInput,
  type TestPermissionInput,
} from '@/services/mcp-registry/mcpPermissionsService';

/**
 * Acesso ao MCP Registry: owner / admin da organização ou platform admin.
 */
export function useCanAccessMcpRegistry() {
  const { isOwner, isAdmin, loading: orgLoading } = useCurrentOrganization();
  const { isPlatformAdmin, loading: paLoading } = usePlatformAdmin();
  return {
    canAccess: isOwner || isAdmin || isPlatformAdmin,
    canEditGlobal: isPlatformAdmin,
    isPlatformAdmin,
    loading: orgLoading || paLoading,
  };
}

const KEY = {
  servers: (orgId: string, f: ServerFilters) => ['mcp', 'servers', orgId, f] as const,
  tools: (orgId: string, f: ToolFilters) => ['mcp', 'tools', orgId, f] as const,
  resources: (orgId: string, f: ResourceFilters) => ['mcp', 'resources', orgId, f] as const,
  prompts: (orgId: string, f: PromptFilters) => ['mcp', 'prompts', orgId, f] as const,
  settings: (orgId: string) => ['mcp', 'settings', orgId] as const,
  overview: (orgId: string) => ['mcp', 'overview', orgId] as const,
  permissions: (orgId: string, f: McpPermissionFilters) => ['mcp', 'permissions', orgId, f] as const,
  permissionMetrics: (orgId: string) => ['mcp', 'permission-metrics', orgId] as const,
  agentsForPerms: (orgId: string) => ['mcp', 'agents-for-perms', orgId] as const,
  usersForPerms: (orgId: string) => ['mcp', 'users-for-perms', orgId] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['mcp'] });
}

// ----- Servers -----
export function useMcpServers(filters: ServerFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.servers(orgId, filters),
    queryFn: () => listMcpServers(orgId, filters),
    enabled: !!orgId,
  });
}

export function useCreateMcpServer() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: CreateMcpServerInput) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpServer(organization.id, input);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpServerInput }) => updateMcpServer(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetMcpServerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: McpStatus }) => setMcpServerStatus(id, status),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Tools -----
export function useMcpTools(filters: ToolFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.tools(orgId, filters),
    queryFn: () => listMcpTools(orgId, filters),
    enabled: !!orgId,
  });
}

export function useCreateMcpTool() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: CreateMcpToolInput) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpTool(organization.id, input);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpToolInput }) => updateMcpTool(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useToggleMcpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleMcpTool(id, enabled),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Resources -----
export function useMcpResources(filters: ResourceFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.resources(orgId, filters),
    queryFn: () => listMcpResources(orgId, filters),
    enabled: !!orgId,
  });
}

export function useCreateMcpResource() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: CreateMcpResourceInput) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpResource(organization.id, input);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpResourceInput }) => updateMcpResource(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useToggleMcpResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleMcpResource(id, enabled),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Prompts -----
export function useMcpPrompts(filters: PromptFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.prompts(orgId, filters),
    queryFn: () => listMcpPrompts(orgId, filters),
    enabled: !!orgId,
  });
}

export function useCreateMcpPrompt() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: CreateMcpPromptInput) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpPrompt(organization.id, input);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpPromptInput }) => updateMcpPrompt(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetMcpPromptStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: McpStatus }) => setMcpPromptStatus(id, status),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Settings -----
export function useMcpSettings() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.settings(orgId),
    queryFn: () => getMcpSettings(orgId),
    enabled: !!orgId,
  });
}

export function useCreateMcpSettings() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: () => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpSettingsIfMissing(organization.id);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpSettingsInput }) => updateMcpSettings(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Overview -----
export function useMcpOverviewMetrics() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.overview(orgId),
    queryFn: () => getMcpOverviewMetrics(orgId),
    enabled: !!orgId,
  });
}
