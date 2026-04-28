import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';
import { useUserContextOptions, useSaveUserContext } from '@/hooks/userContext/useUserContextData';
import type { UserContextRow } from '@/services/crm/userContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: UserContextRow | null;
  tenantId: string;
  organizationId: string;
  canEdit: boolean;
}

export function EditUserContextModal({ open, onOpenChange, row, tenantId, organizationId, canEdit }: Props) {
  const { data: options, isLoading: loadingOptions } = useUserContextOptions(open ? tenantId : null);
  const save = useSaveUserContext(tenantId, organizationId);

  const [permissionId, setPermissionId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [functionId, setFunctionId] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending' | 'blocked'>('active');
  const [markReviewed, setMarkReviewed] = useState<boolean>(false);
  const [reviewNote, setReviewNote] = useState<string>('');

  // Hydrate from row + options
  useEffect(() => {
    if (!open || !options || !row) return;
    const perm = options.permissions.find((p) => p.key === row.permission_key);
    const dept = options.departments.find((d) => d.key === row.department_key);
    const func = options.functions.find((f) => f.key === row.business_function_key);
    setPermissionId(perm?.id ?? '');
    setDepartmentId(dept?.id ?? '');
    setFunctionId(func?.id ?? '');
    setStatus(((row.status as any) || 'active'));
    setMarkReviewed(false);
    setReviewNote('');
  }, [open, options, row]);

  // Filter functions by selected department; clear if mismatch
  const filteredFunctions = useMemo(() => {
    if (!options) return [];
    if (!departmentId) return [];
    return options.functions.filter((f) => f.department_id === departmentId);
  }, [options, departmentId]);

  useEffect(() => {
    if (!functionId) return;
    if (!filteredFunctions.find((f) => f.id === functionId)) {
      setFunctionId('');
    }
  }, [filteredFunctions, functionId]);

  if (!row) return null;

  const meta = (row.metadata || {}) as Record<string, any>;
  const requiresReview = meta.requires_review === true;
  const mappingConfidence = meta.mapping_confidence as string | undefined;
  const reviewReason = meta.review_reason as string | undefined;

  const canSubmit = canEdit && !!permissionId && !!departmentId && !!functionId && !!status && !save.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    save.mutate(
      {
        tenant_id: tenantId,
        user_id: row.user_id,
        permission_role_id: permissionId,
        department_id: departmentId,
        business_function_id: functionId,
        status,
        mark_as_reviewed: markReviewed,
        review_note: reviewNote || null,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar contexto CRM</DialogTitle>
          <DialogDescription>
            Esta configuração prepara dashboards, automações e regras futuras. Ela ainda não altera o acesso real do
            usuário nesta sprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{row.full_name || 'Sem nome'}</div>
            <div className="text-muted-foreground">{row.email || '—'}</div>
          </div>

          {!row.context_id && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Este usuário ainda não possui contexto CRM. Crie uma configuração para preparar dashboards e automações
                futuras.
              </AlertDescription>
            </Alert>
          )}

          {loadingOptions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="permission">Permissão *</Label>
                <Select value={permissionId} onValueChange={setPermissionId} disabled={!canEdit}>
                  <SelectTrigger id="permission">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.permissions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="department">Área *</Label>
                <Select value={departmentId} onValueChange={setDepartmentId} disabled={!canEdit}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="function">Função *</Label>
                <Select
                  value={functionId}
                  onValueChange={setFunctionId}
                  disabled={!canEdit || !departmentId}
                >
                  <SelectTrigger id="function">
                    <SelectValue placeholder={departmentId ? 'Selecione' : 'Selecione uma área primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFunctions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)} disabled={!canEdit}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="mark-reviewed"
                  checked={markReviewed}
                  onCheckedChange={(v) => setMarkReviewed(v === true)}
                  disabled={!canEdit}
                />
                <div className="grid gap-1">
                  <Label htmlFor="mark-reviewed" className="cursor-pointer">
                    Marcar como revisado
                  </Label>
                  {requiresReview && (
                    <span className="text-xs text-muted-foreground">
                      Este contexto está marcado como pendente de revisão.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="review-note">Observação da revisão</Label>
                <Textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Opcional"
                  rows={3}
                  disabled={!canEdit}
                />
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
                <div className="font-medium mb-1">Dados legados</div>
                <div>
                  <span className="text-muted-foreground">Tipo legado: </span>
                  {row.legacy_user_type || row.org_role || '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Função comercial legada: </span>
                  {row.legacy_commercial_function || '—'}
                </div>
                {mappingConfidence && (
                  <div>
                    <span className="text-muted-foreground">Confiança do mapeamento: </span>
                    {mappingConfidence}
                  </div>
                )}
                {reviewReason && (
                  <div>
                    <span className="text-muted-foreground">Motivo da revisão: </span>
                    {reviewReason}
                  </div>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Essa alteração não muda o acesso real do usuário nesta sprint. A lógica antiga continua ativa até
                  liberação das próximas sprints.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar contexto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
