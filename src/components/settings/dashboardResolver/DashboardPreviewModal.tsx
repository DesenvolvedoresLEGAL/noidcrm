import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useResolveDashboardPreview } from '@/hooks/dashboard/useDashboardResolver';
import { DashboardCandidateList } from './DashboardCandidateList';
import { DashboardResolutionDetails } from './DashboardResolutionDetails';
import { DynamicDashboardShell } from '@/components/dashboard/dynamic/DynamicDashboardShell';
import { logCloserDashboardView } from '@/services/crm/closerDashboardAudit';
import type { UserContextRow } from '@/services/crm/userContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: UserContextRow | null;
  tenantId: string;
}

export function DashboardPreviewModal({ open, onOpenChange, row, tenantId }: Props) {
  const mutation = useResolveDashboardPreview();
  const result = mutation.data;
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && row?.user_id && tenantId) {
      mutation.reset();
      loggedRef.current = null;
      mutation.mutate({ tenantId, userId: row.user_id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.user_id, tenantId]);

  // Log preview view once per opened user
  useEffect(() => {
    if (!open || !result || !row?.user_id || !tenantId) return;
    const isCloser = result.context?.business_function_key === 'closer';
    if (!isCloser) return;
    if (loggedRef.current === row.user_id) return;
    loggedRef.current = row.user_id;
    logCloserDashboardView({
      tenantId,
      targetUserId: row.user_id,
      source: 'preview',
      period: 'current_month',
      metadata: {
        resolution_source: result.resolution_source,
        profile_key: result.resolved_profile?.key ?? null,
      },
    });
  }, [open, result, row?.user_id, tenantId]);

  const requiresReview = !!row?.metadata?.requires_review;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview do Dashboard Dinâmico</DialogTitle>
          <DialogDescription>
            Este é apenas um teste. O dashboard real do usuário <strong>não foi alterado</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Identidade do usuário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded border p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuário</p>
            <p className="text-sm font-medium">{row?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="text-sm">{row?.email || '—'}</p>
          </div>
        </div>

        {mutation.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível resolver o dashboard. {(mutation.error as Error)?.message}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <DynamicDashboardShell
              profile={result?.resolved_profile ?? null}
              resolution={result ?? null}
              mode="preview"
              loading={mutation.isPending}
              tenantId={tenantId}
              targetUserId={row?.user_id}
            />

            {result && (
              <>
                <DashboardResolutionDetails result={result} requiresReview={requiresReview} />

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Candidatos avaliados</h4>
                  <DashboardCandidateList candidates={result.candidate_profiles || []} />
                </div>
              </>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
