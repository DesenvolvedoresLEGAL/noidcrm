import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle } from 'lucide-react';
import { DashboardResolutionBadge } from './DashboardResolutionBadge';
import type { DashboardResolutionResult } from '@/services/crm/dashboardProfiles';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export function DashboardResolutionDetails({
  result,
  requiresReview,
}: {
  result: DashboardResolutionResult;
  requiresReview?: boolean;
}) {
  const permissionKey = (result.context.permission_key || '').toLowerCase();
  const isAdminPermission = permissionKey === 'admin';
  const isOwnerOverride =
    !!result.owner_override || result.resolution_source === 'owner_override';

  return (
    <div className="space-y-4">
      {requiresReview && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este usuário ainda está marcado para revisão. Confirme a função antes de ativar dashboards dinâmicos.
          </AlertDescription>
        </Alert>
      )}

      {!result.flags.dynamic_dashboards_enabled && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Dashboards dinâmicos estão desligados globalmente. Este preview mostra apenas
            qual dashboard <strong>seria</strong> escolhido — o dashboard real do usuário não muda.
          </AlertDescription>
        </Alert>
      )}

      {!result.context.is_dashboard_dynamic_enabled && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este usuário ainda não está habilitado individualmente para dashboard dinâmico.
          </AlertDescription>
        </Alert>
      )}

      {isAdminPermission && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Permissão <strong>Admin</strong> libera gestão do CRM (Admin Center), mas o dashboard principal segue a função/área do usuário.
          </AlertDescription>
        </Alert>
      )}

      {isOwnerOverride && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Override de <strong>Owner</strong>: usuários com permissão Owner sempre resolvem para o cockpit executivo, mesmo com função ou área mapeadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 rounded border p-4">
        <Field label="Permissão" value={result.context.permission_key || '—'} />
        <Field label="Área" value={result.context.department_key || '—'} />
        <Field label="Função" value={result.context.business_function_key || '—'} />
        <Field
          label="Flag global"
          value={
            <Badge variant={result.flags.dynamic_dashboards_enabled ? 'default' : 'outline'}>
              {result.flags.dynamic_dashboards_enabled ? 'Ativada' : 'Desligada'}
            </Badge>
          }
        />
      </div>

      <div className="space-y-3 rounded border p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard resolvido</p>
            <p className="text-base font-semibold">
              {result.resolved_profile?.name || 'Nenhum'}{' '}
              {result.resolved_profile?.key && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {result.resolved_profile.key}
                </span>
              )}
            </p>
          </div>
          <DashboardResolutionBadge source={result.resolution_source} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fonte" value={result.resolution_source} />
          <Field label="Fallback usado" value={result.fallback_used ? 'Sim' : 'Não'} />
          <Field label="Motivo do fallback" value={result.fallback_reason || '—'} />
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Uso real:{' '}
            <strong>
              {result.should_use_dynamic_dashboard
                ? 'Sim, dashboard dinâmico seria ativado.'
                : 'Não, dashboard atual permanece ativo.'}
            </strong>{' '}
            Este preview não altera o dashboard real do usuário.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
