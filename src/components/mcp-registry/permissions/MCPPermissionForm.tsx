import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMcpTools, useMcpResources, useMcpPrompts, useAiAgentsForPermissions, useUsersForPermissions, useCreateMcpPermission, useUpdateMcpPermission } from '@/hooks/useMcpRegistry';
import { MCP_ROLE_SUGGESTIONS } from '@/services/mcp-registry/mcpPermissionsService';
import type { McpPermission, McpPermissionStatus, McpPermissionTargetType, McpPermissionObjectType } from '@/services/mcp-registry/types';

interface Props {
  open: boolean;
  onClose: () => void;
  permission?: McpPermission | null;
}

interface FormState {
  targetType: McpPermissionTargetType;
  agentId: string;
  userId: string;
  roleName: string;
  objectType: McpPermissionObjectType;
  toolId: string;
  resourceId: string;
  promptId: string;
  can_read: boolean;
  can_suggest: boolean;
  can_execute: boolean;
  requires_approval: boolean;
  max_calls_per_day: string;
  allowed_scopes: string;
  metadata: string;
  status: McpPermissionStatus;
}

const initial = (p?: McpPermission | null): FormState => ({
  targetType: p?.agent_id ? 'agent' : p?.user_id ? 'user' : 'role',
  agentId: p?.agent_id ?? '',
  userId: p?.user_id ?? '',
  roleName: p?.role_name ?? '',
  objectType: p?.tool_id ? 'tool' : p?.resource_id ? 'resource' : p?.prompt_id ? 'prompt' : 'tool',
  toolId: p?.tool_id ?? '',
  resourceId: p?.resource_id ?? '',
  promptId: p?.prompt_id ?? '',
  can_read: p?.can_read ?? false,
  can_suggest: p?.can_suggest ?? false,
  can_execute: p?.can_execute ?? false,
  requires_approval: p?.requires_approval ?? true,
  max_calls_per_day: p?.max_calls_per_day != null ? String(p.max_calls_per_day) : '',
  allowed_scopes: JSON.stringify(p?.allowed_scopes ?? [], null, 2),
  metadata: JSON.stringify(p?.metadata ?? {}, null, 2),
  status: p?.status ?? 'active',
});

export function MCPPermissionForm({ open, onClose, permission }: Props) {
  const isEdit = !!permission;
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => initial(permission));

  useEffect(() => {
    if (open) setForm(initial(permission));
  }, [open, permission]);

  const { data: tools = [] } = useMcpTools();
  const { data: resources = [] } = useMcpResources();
  const { data: prompts = [] } = useMcpPrompts();
  const { data: agents = [] } = useAiAgentsForPermissions();
  const { data: users = [] } = useUsersForPermissions();

  const createMut = useCreateMcpPermission();
  const updateMut = useUpdateMcpPermission();

  const selectedTool = useMemo(() => tools.find((t) => t.id === form.toolId), [tools, form.toolId]);
  const selectedResource = useMemo(() => resources.find((r) => r.id === form.resourceId), [resources, form.resourceId]);
  const selectedPrompt = useMemo(() => prompts.find((p) => p.id === form.promptId), [prompts, form.promptId]);

  // ----- Regras de segurança CLIENT (espelham RPC) -----
  const isPrompt = form.objectType === 'prompt';
  const isResourceAdminOnly = form.objectType === 'resource' && selectedResource?.read_scope === 'admin_only';
  const toolCritical = form.objectType === 'tool' && selectedTool?.risk_level === 'critical';
  const toolAutoControlled = form.objectType === 'tool' && selectedTool?.execution_mode === 'automatic_controlled';
  const toolMidHighRisk = form.objectType === 'tool' && (['medium', 'high', 'critical'] as string[]).includes(selectedTool?.risk_level ?? '');
  const toolApprovalRequired = form.objectType === 'tool' && selectedTool?.execution_mode === 'approval_required';

  const executeBlocked = isPrompt || toolCritical || toolAutoControlled;
  const suggestBlocked = isResourceAdminOnly;
  const approvalForced = (form.can_execute && (toolMidHighRisk || toolApprovalRequired));

  // Auto-corrige flags se objeto mudar
  useEffect(() => {
    setForm((f) => ({
      ...f,
      can_execute: executeBlocked ? false : f.can_execute,
      can_suggest: suggestBlocked ? false : f.can_suggest,
      can_read: isResourceAdminOnly ? true : f.can_read,
      requires_approval: approvalForced ? true : f.requires_approval,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.objectType, form.toolId, form.resourceId, form.promptId, executeBlocked, suggestBlocked, approvalForced, isResourceAdminOnly]);

  const handleSubmit = async () => {
    // Validação client
    let allowed_scopes: unknown[];
    let metadata: Record<string, unknown>;
    try {
      const s = JSON.parse(form.allowed_scopes || '[]');
      if (!Array.isArray(s)) throw new Error('JSON inválido em allowed_scopes (array esperado)');
      allowed_scopes = s;
    } catch {
      toast({ title: 'JSON inválido em allowed_scopes', variant: 'destructive' });
      return;
    }
    try {
      const m = JSON.parse(form.metadata || '{}');
      if (typeof m !== 'object' || Array.isArray(m)) throw new Error('object esperado');
      metadata = m;
    } catch {
      toast({ title: 'JSON inválido em metadata', variant: 'destructive' });
      return;
    }

    if (form.status === 'active' && !(form.can_read || form.can_suggest || form.can_execute)) {
      toast({ title: 'Selecione ao menos uma permissão', variant: 'destructive' });
      return;
    }
    const max = form.max_calls_per_day ? Number(form.max_calls_per_day) : null;
    if (max !== null && (!Number.isFinite(max) || max <= 0)) {
      toast({ title: 'Limite diário inválido', variant: 'destructive' });
      return;
    }

    const enrichedMeta = { ...metadata, source: 'mcp_registry_ui', area: 'noid_intelligence', sprint: '1.4' };

    try {
      if (isEdit && permission) {
        await updateMut.mutateAsync({
          id: permission.id,
          input: {
            can_read: form.can_read,
            can_suggest: form.can_suggest,
            can_execute: form.can_execute,
            requires_approval: form.requires_approval,
            max_calls_per_day: max,
            allowed_scopes,
            status: form.status,
            metadata: enrichedMeta,
          },
        });
        toast({ title: 'Permissão atualizada' });
      } else {
        // Validações de alvo/objeto
        if (form.targetType === 'agent' && !form.agentId) {
          toast({ title: 'Selecione um agente', variant: 'destructive' }); return;
        }
        if (form.targetType === 'user' && !form.userId) {
          toast({ title: 'Selecione um usuário', variant: 'destructive' }); return;
        }
        if (form.targetType === 'role' && !form.roleName.trim()) {
          toast({ title: 'Informe o nome do papel', variant: 'destructive' }); return;
        }
        if (form.objectType === 'tool' && !form.toolId) {
          toast({ title: 'Selecione uma tool', variant: 'destructive' }); return;
        }
        if (form.objectType === 'resource' && !form.resourceId) {
          toast({ title: 'Selecione um resource', variant: 'destructive' }); return;
        }
        if (form.objectType === 'prompt' && !form.promptId) {
          toast({ title: 'Selecione um prompt', variant: 'destructive' }); return;
        }

        await createMut.mutateAsync({
          agent_id: form.targetType === 'agent' ? form.agentId : null,
          user_id: form.targetType === 'user' ? form.userId : null,
          role_name: form.targetType === 'role' ? form.roleName.trim() : null,
          tool_id: form.objectType === 'tool' ? form.toolId : null,
          resource_id: form.objectType === 'resource' ? form.resourceId : null,
          prompt_id: form.objectType === 'prompt' ? form.promptId : null,
          can_read: form.can_read,
          can_suggest: form.can_suggest,
          can_execute: form.can_execute,
          requires_approval: form.requires_approval,
          max_calls_per_day: max,
          allowed_scopes,
          status: form.status,
          metadata: enrichedMeta,
        });
        toast({ title: 'Permissão criada' });
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar permissão';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar permissão' : 'Nova permissão MCP'}</DialogTitle>
          <DialogDescription>
            Controle quem pode ler, sugerir ou executar este objeto. Esta sprint não executa ações reais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ALVO */}
          <fieldset disabled={isEdit} className="space-y-3 border rounded-md p-4">
            <legend className="text-sm font-semibold px-2">Alvo</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de alvo</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as McpPermissionTargetType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                {form.targetType === 'agent' && (
                  <>
                    <Label className="text-xs">Agente</Label>
                    <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                      <SelectTrigger><SelectValue placeholder={agents.length ? 'Selecione' : 'Nenhum agente disponível'} /></SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {form.targetType === 'user' && (
                  <>
                    <Label className="text-xs">Usuário</Label>
                    <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.slice(0, 8)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {form.targetType === 'role' && (
                  <>
                    <Label className="text-xs">Nome do papel</Label>
                    <Select value={form.roleName} onValueChange={(v) => setForm({ ...form, roleName: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione ou digite" /></SelectTrigger>
                      <SelectContent>
                        {MCP_ROLE_SUGGESTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Ou digite custom..."
                      value={form.roleName}
                      onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                      className="mt-2"
                    />
                  </>
                )}
              </div>
            </div>
          </fieldset>

          {/* OBJETO */}
          <fieldset disabled={isEdit} className="space-y-3 border rounded-md p-4">
            <legend className="text-sm font-semibold px-2">Objeto protegido</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de objeto</Label>
                <Select value={form.objectType} onValueChange={(v) => setForm({ ...form, objectType: v as McpPermissionObjectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="resource">Resource</SelectItem>
                    <SelectItem value="prompt">Prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                {form.objectType === 'tool' && (
                  <>
                    <Label className="text-xs">Tool</Label>
                    <Select value={form.toolId} onValueChange={(v) => setForm({ ...form, toolId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {tools.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · {t.risk_level} · {t.execution_mode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {form.objectType === 'resource' && (
                  <>
                    <Label className="text-xs">Resource</Label>
                    <Select value={form.resourceId} onValueChange={(v) => setForm({ ...form, resourceId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {resources.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} · {r.read_scope}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {form.objectType === 'prompt' && (
                  <>
                    <Label className="text-xs">Prompt</Label>
                    <Select value={form.promptId} onValueChange={(v) => setForm({ ...form, promptId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {prompts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.prompt_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </fieldset>

          {/* AVISOS */}
          {toolCritical && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Tools críticas não podem receber execução nesta fase.</AlertDescription>
            </Alert>
          )}
          {toolAutoControlled && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Execução automática controlada ainda não está liberada nesta fase.</AlertDescription>
            </Alert>
          )}
          {isResourceAdminOnly && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Resource admin_only: apenas can_read é permitido.</AlertDescription>
            </Alert>
          )}
          {isPrompt && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Execução de prompt não está liberada nesta sprint.</AlertDescription>
            </Alert>
          )}
          {approvalForced && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Tool de risco médio+ com execução: aprovação manual será forçada.</AlertDescription>
            </Alert>
          )}

          {/* PERMISSÕES */}
          <div className="space-y-3 border rounded-md p-4">
            <h4 className="text-sm font-semibold">Permissões</h4>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">Read</span>
                <Switch checked={form.can_read} onCheckedChange={(v) => setForm({ ...form, can_read: v })} />
              </label>
              <label className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">Suggest</span>
                <Switch
                  checked={form.can_suggest}
                  disabled={suggestBlocked}
                  onCheckedChange={(v) => setForm({ ...form, can_suggest: v })}
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">Execute</span>
                <Switch
                  checked={form.can_execute}
                  disabled={executeBlocked}
                  onCheckedChange={(v) => setForm({ ...form, can_execute: v })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">Requer aprovação</span>
                <Switch
                  checked={form.requires_approval}
                  disabled={approvalForced}
                  onCheckedChange={(v) => setForm({ ...form, requires_approval: v })}
                />
              </label>
              <div className="space-y-1">
                <Label className="text-xs">Limite diário (opcional)</Label>
                <Input
                  type="number" min={1}
                  value={form.max_calls_per_day}
                  onChange={(e) => setForm({ ...form, max_calls_per_day: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* AVANÇADO */}
          <details className="border rounded-md p-4">
            <summary className="text-sm font-semibold cursor-pointer">Avançado</summary>
            <div className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as McpPermissionStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">allowed_scopes (JSON array)</Label>
                <textarea
                  className="w-full border rounded p-2 font-mono text-xs h-24 bg-background"
                  value={form.allowed_scopes}
                  onChange={(e) => setForm({ ...form, allowed_scopes: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">metadata (JSON object)</Label>
                <textarea
                  className="w-full border rounded p-2 font-mono text-xs h-24 bg-background"
                  value={form.metadata}
                  onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                />
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar permissão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
