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
import {
  listMcpInvocations,
  getMcpInvocationById,
  createSimulatedMcpInvocation,
  getMcpInvocationMetrics,
  listMcpToolsForInvocation,
  type InvocationFilters,
  type CreateSimulatedInvocationInput,
} from '@/services/mcp-registry/mcpInvocationsService';
import {
  listMcpAuditLogs,
  getMcpAuditLogById,
  getMcpAuditMetrics,
  type AuditLogFilters,
} from '@/services/mcp-registry/mcpAuditService';

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

// ===================== PERMISSIONS (Sprint 1.4) =====================

export function useMcpPermissions(filters: McpPermissionFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.permissions(orgId, filters),
    queryFn: () => listMcpPermissions(orgId, filters),
    enabled: !!orgId,
  });
}

export function useMcpPermissionMetrics() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.permissionMetrics(orgId),
    queryFn: () => getMcpPermissionMetrics(orgId),
    enabled: !!orgId,
  });
}

export function useCreateMcpPermission() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: CreateMcpPermissionInput) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createMcpPermission(organization.id, input);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMcpPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMcpPermissionInput }) =>
      updateMcpPermission(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetMcpPermissionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: McpPermissionStatus }) =>
      setMcpPermissionStatus(id, status),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useArchiveMcpPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveMcpPermission(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useTestMcpPermission() {
  return useMutation({
    mutationFn: (input: TestPermissionInput) => testMcpPermission(input),
  });
}

export function useAiAgentsForPermissions() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.agentsForPerms(orgId),
    queryFn: () => listAiAgentsForPermissions(orgId),
    enabled: !!orgId,
  });
}

export function useUsersForPermissions() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY.usersForPerms(orgId),
    queryFn: () => listUsersForPermissions(orgId),
    enabled: !!orgId,
  });
}

// ===================== INVOCATIONS & AUDIT (Sprint 1.5) =====================

const KEY_S15 = {
  invocations: (orgId: string, f: InvocationFilters) => ['mcp', 'invocations', orgId, f] as const,
  invocationDetail: (id: string) => ['mcp', 'invocation', id] as const,
  invocationMetrics: (orgId: string) => ['mcp', 'invocation-metrics', orgId] as const,
  toolsForInvocation: (orgId: string) => ['mcp', 'tools-for-invocation', orgId] as const,
  auditLogs: (orgId: string, f: AuditLogFilters) => ['mcp', 'audit-logs', orgId, f] as const,
  auditDetail: (id: string) => ['mcp', 'audit-log', id] as const,
  auditMetrics: (orgId: string) => ['mcp', 'audit-metrics', orgId] as const,
};

export function useMcpInvocations(filters: InvocationFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY_S15.invocations(orgId, filters),
    queryFn: () => listMcpInvocations(orgId, filters),
    enabled: !!orgId,
  });
}

export function useMcpInvocationDetail(id: string | null) {
  return useQuery({
    queryKey: KEY_S15.invocationDetail(id ?? ''),
    queryFn: () => getMcpInvocationById(id as string),
    enabled: !!id,
  });
}

export function useMcpInvocationMetrics() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY_S15.invocationMetrics(orgId),
    queryFn: () => getMcpInvocationMetrics(orgId),
    enabled: !!orgId,
  });
}

export function useCreateSimulatedMcpInvocation() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: (input: Omit<CreateSimulatedInvocationInput, 'orgId'>) => {
      if (!organization?.id) throw new Error('Organização não definida');
      return createSimulatedMcpInvocation({ ...input, orgId: organization.id });
    },
    onSuccess: () => {
      // Sucesso E blocked invalidam: ambos geram registros novos.
      invalidateAll(qc);
    },
  });
}

export function useMcpToolsForInvocation() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY_S15.toolsForInvocation(orgId),
    queryFn: () => listMcpToolsForInvocation(orgId),
    enabled: !!orgId,
  });
}

export function useMcpAuditLogs(filters: AuditLogFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY_S15.auditLogs(orgId, filters),
    queryFn: () => listMcpAuditLogs(orgId, filters),
    enabled: !!orgId,
  });
}

export function useMcpAuditLogDetail(id: string | null) {
  return useQuery({
    queryKey: KEY_S15.auditDetail(id ?? ''),
    queryFn: () => getMcpAuditLogById(id as string),
    enabled: !!id,
  });
}

export function useMcpAuditMetrics() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  return useQuery({
    queryKey: KEY_S15.auditMetrics(orgId),
    queryFn: () => getMcpAuditMetrics(orgId),
    enabled: !!orgId,
  });
}
