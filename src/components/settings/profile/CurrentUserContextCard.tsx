import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Edit, Loader2 } from 'lucide-react';
import { useUserContextSelf } from '@/hooks/userContext/useUserContextSelf';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getReviewStatus, type ReviewStatus } from '@/hooks/userContext/useUserContextData';
import { EditUserContextModal } from '@/components/settings/userContext/EditUserContextModal';
import { useState } from 'react';

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  validated: 'Validado',
  needs_review: 'Pendente de revisão',
  incomplete: 'Incompleto',
  no_context: 'Sem contexto',
};

const REVIEW_VARIANT: Record<ReviewStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  validated: 'default',
  needs_review: 'destructive',
  incomplete: 'outline',
  no_context: 'secondary',
};

export function CurrentUserContextCard() {
  const { user, organization, isOrgAdmin } = useCurrentUser();
  const tenantId = organization?.id ?? null;
  const userId = user?.id ?? null;
  const { data: row, isLoading } = useUserContextSelf(tenantId, userId);
  const [editing, setEditing] = useState(false);

  const reviewStatus: ReviewStatus = row ? getReviewStatus(row) : 'no_context';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Contexto CRM atual</CardTitle>
                <CardDescription>
                  Configuração usada para dashboards dinâmicos, automações e regras futuras.
                </CardDescription>
              </div>
            </div>
            {isOrgAdmin && row && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                disabled={isLoading}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar Contexto CRM
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Permissão" value={row?.permission_name} />
              <Field label="Área" value={row?.department_name} />
              <Field label="Função" value={row?.business_function_name} />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={REVIEW_VARIANT[reviewStatus]}>{REVIEW_LABEL[reviewStatus]}</Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Dashboard dinâmico</div>
                <Badge variant={row?.is_dashboard_dynamic_enabled ? 'default' : 'outline'}>
                  {row?.is_dashboard_dynamic_enabled ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          )}
          {!isOrgAdmin && (
            <p className="mt-4 text-xs text-muted-foreground">
              Apenas administradores podem alterar este contexto. Solicite ao admin da sua organização.
            </p>
          )}
        </CardContent>
      </Card>

      {tenantId && (
        <EditUserContextModal
          open={editing}
          onOpenChange={setEditing}
          row={row ?? null}
          tenantId={tenantId}
          organizationId={tenantId}
          canEdit={!!isOrgAdmin}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
