import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useMcpTools, useMcpResources, useMcpPrompts, useAiAgentsForPermissions, useUsersForPermissions, useTestMcpPermission } from '@/hooks/useMcpRegistry';
import { MCP_ROLE_SUGGESTIONS } from '@/services/mcp-registry/mcpPermissionsService';
import type { McpPermissionAction, McpPermissionTargetType, McpPermissionObjectType, CheckPermissionResult } from '@/services/mcp-registry/types';
import { Beaker, CheckCircle2, XCircle, Lock, Unlock } from 'lucide-react';

export function MCPPermissionTestPanel() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';

  const [targetType, setTargetType] = useState<McpPermissionTargetType>('role');
  const [agentId, setAgentId] = useState('');
  const [userId, setUserId] = useState('');
  const [roleName, setRoleName] = useState('admin');
  const [objectType, setObjectType] = useState<McpPermissionObjectType>('tool');
  const [toolId, setToolId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [promptId, setPromptId] = useState('');
  const [action, setAction] = useState<McpPermissionAction>('read');
  const [result, setResult] = useState<CheckPermissionResult | null>(null);

  const { data: tools = [] } = useMcpTools();
  const { data: resources = [] } = useMcpResources();
  const { data: prompts = [] } = useMcpPrompts();
  const { data: agents = [] } = useAiAgentsForPermissions();
  const { data: users = [] } = useUsersForPermissions();

  const testMut = useTestMcpPermission();

  const handleTest = async () => {
    if (!orgId) return;
    setResult(null);
    try {
      const r = await testMut.mutateAsync({
        organization_id: orgId,
        agent_id: targetType === 'agent' ? agentId : null,
        user_id: targetType === 'user' ? userId : null,
        role_name: targetType === 'role' ? roleName : null,
        tool_id: objectType === 'tool' ? toolId : null,
        resource_id: objectType === 'resource' ? resourceId : null,
        prompt_id: objectType === 'prompt' ? promptId : null,
        action,
      });
      setResult(r);
    } catch (e) {
      setResult({ allowed: false, requires_approval: false, reason: e instanceof Error ? e.message : 'erro' });
    }
  };

  const valid =
    !!orgId &&
    ((targetType === 'agent' && !!agentId) ||
      (targetType === 'user' && !!userId) ||
      (targetType === 'role' && !!roleName.trim())) &&
    ((objectType === 'tool' && !!toolId) ||
      (objectType === 'resource' && !!resourceId) ||
      (objectType === 'prompt' && !!promptId));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-primary" />
          <CardTitle>Testar permissão MCP</CardTitle>
        </div>
        <CardDescription>
          Valide se um agente, usuário ou papel pode realizar uma ação sobre uma tool, resource ou prompt.
          Este teste não executa tools nem altera dados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de alvo</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as McpPermissionTargetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="role">Role</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            {targetType === 'agent' && (
              <>
                <Label className="text-xs">Agente</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {targetType === 'user' && (
              <>
                <Label className="text-xs">Usuário</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {targetType === 'role' && (
              <>
                <Label className="text-xs">Papel</Label>
                <div className="flex gap-2">
                  <Select value={roleName} onValueChange={setRoleName}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MCP_ROLE_SUGGESTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} className="w-40" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de objeto</Label>
            <Select value={objectType} onValueChange={(v) => setObjectType(v as McpPermissionObjectType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tool">Tool</SelectItem>
                <SelectItem value="resource">Resource</SelectItem>
                <SelectItem value="prompt">Prompt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            {objectType === 'tool' && (
              <>
                <Label className="text-xs">Tool</Label>
                <Select value={toolId} onValueChange={setToolId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {tools.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {objectType === 'resource' && (
              <>
                <Label className="text-xs">Resource</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {objectType === 'prompt' && (
              <>
                <Label className="text-xs">Prompt</Label>
                <Select value={promptId} onValueChange={setPromptId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {prompts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as McpPermissionAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="read">read</SelectItem>
                <SelectItem value="suggest">suggest</SelectItem>
                <SelectItem value="execute">execute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleTest} disabled={!valid || testMut.isPending} className="w-full md:w-auto">
              {testMut.isPending ? 'Testando…' : 'Testar permissão'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {result.allowed ? (
                <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3 w-3" /> Permissão concedida
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Permissão negada
                </Badge>
              )}
              {result.requires_approval ? (
                <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
                  <Lock className="h-3 w-3" /> Exige aprovação
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Unlock className="h-3 w-3" /> Sem aprovação obrigatória
                </Badge>
              )}
            </div>
            {result.reason && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</Label>
                <p className="text-sm mt-1 text-foreground">{result.reason}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
