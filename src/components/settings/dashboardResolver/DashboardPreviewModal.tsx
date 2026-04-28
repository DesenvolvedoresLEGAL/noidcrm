import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useResolveDashboardPreview } from '@/hooks/dashboard/useDashboardResolver';
import { DashboardResolutionBadge } from './DashboardResolutionBadge';
import { DashboardCandidateList } from './DashboardCandidateList';
import { DashboardPlaceholderWidgets } from './DashboardPlaceholderWidgets';
import type { UserContextRow } from '@/services/crm/userContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: UserContextRow | null;
  tenantId: string;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export function DashboardPreviewModal({ open, onOpenChange, row, tenantId }: Props) {
  const mutation = useResolveDashboardPreview();
  const result = mutation.data;

  useEffect(() => {
    if (open && row?.user_id && tenantId) {
      mutation.reset();
      mutation.mutate({ tenantId, userId: row.user_id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.user_id, tenantId]);

  const requiresReview = !!row?.metadata?.requires_review;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview do Dashboard Dinâmico</DialogTitle>
          <DialogDescription>
            Este é apenas um teste de resolução. O dashboard real do usuário <strong>não foi alterado</strong>.
          </DialogDescription>
        </DialogHeader>

        {requiresReview && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este usuário ainda está marcado para revisão. Confirme a função antes de ativar dashboard dinâmico.
            </AlertDescription>
          </Alert>
        )}

        {mutation.isPending ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : mutation.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível resolver o dashboard. {(mutation.error as Error)?.message}
            </AlertDescription>
          </Alert>
        ) : result ? (
          <div className="space-y-5">
            {/* Identidade */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded border p-4">
              <Field label="Usuário" value={row?.full_name || row?.email || row?.user_id} />
              <Field label="Permissão" value={result.context.permission_key || '—'} />
              <Field label="Área" value={result.context.department_key || '—'} />
              <Field label="Função" value={result.context.business_function_key || '—'} />
            </div>

            {/* Flags */}
            <div className="grid grid-cols-2 gap-4 rounded border p-4">
              <Field
                label="Flag global dynamic_dashboards_enabled"
                value={
                  <Badge variant={result.flags.dynamic_dashboards_enabled ? 'default' : 'outline'}>
                    {result.flags.dynamic_dashboards_enabled ? 'Ativada' : 'Desligada'}
                  </Badge>
                }
              />
              <Field
                label="Flag individual is_dashboard_dynamic_enabled"
                value={
                  <Badge variant={result.context.is_dashboard_dynamic_enabled ? 'default' : 'outline'}>
                    {result.context.is_dashboard_dynamic_enabled ? 'Ativada' : 'Desligada'}
                  </Badge>
                }
              />
            </div>

            {/* Resolução */}
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
                  </strong>
                </AlertDescription>
              </Alert>
            </div>

            {/* Candidatos */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Candidatos avaliados</h4>
              <DashboardCandidateList candidates={result.candidate_profiles || []} />
            </div>

            {/* Widgets */}
            {result.resolved_profile?.widgets && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Widgets do profile resolvido</h4>
                <DashboardPlaceholderWidgets widgets={result.resolved_profile.widgets} />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
