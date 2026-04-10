import { useEffect } from 'react';
import { Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAgentEnvironments, useUpdateAgentEnvironment, useInitializeEnvironments } from '@/hooks/useAIAgents';
import { ENVIRONMENT_LABELS, ENVIRONMENT_COLORS } from '@/types/ai-agents';
import type { AgentEnvironment } from '@/types/ai-agents';

export default function EnvironmentsPage() {
  const { profile } = useCurrentUser();
  const orgId = profile?.organization_id;
  const { data: environments, isLoading } = useAgentEnvironments(orgId);
  const updateMutation = useUpdateAgentEnvironment();
  const initMutation = useInitializeEnvironments();

  useEffect(() => {
    if (orgId && environments && environments.length === 0) {
      initMutation.mutate(orgId);
    }
  }, [orgId, environments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ambientes de Execução</h1>
          <p className="text-sm text-muted-foreground">Configure regras de execução por ambiente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(environments || []).map((env) => (
          <Card key={env.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{ENVIRONMENT_LABELS[env.environment as AgentEnvironment] || env.environment}</CardTitle>
                <Badge className={ENVIRONMENT_COLORS[env.environment as AgentEnvironment] || ''}>
                  {env.environment}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir execução</Label>
                <Switch
                  checked={env.allow_execution}
                  onCheckedChange={(v) => updateMutation.mutate({ id: env.id, allow_execution: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Exigir aprovação</Label>
                <Switch
                  checked={env.require_approval}
                  onCheckedChange={(v) => updateMutation.mutate({ id: env.id, require_approval: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir autonomia</Label>
                <Switch
                  checked={env.allow_autonomous}
                  onCheckedChange={(v) => updateMutation.mutate({ id: env.id, allow_autonomous: v })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Máx. ações por hora</Label>
                <Input
                  type="number"
                  value={env.max_actions_per_hour}
                  onChange={(e) => updateMutation.mutate({ id: env.id, max_actions_per_hour: parseInt(e.target.value) || 0 })}
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!environments || environments.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhum ambiente configurado</p>
            <Button onClick={() => orgId && initMutation.mutate(orgId)} disabled={initMutation.isPending}>
              Inicializar Ambientes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
