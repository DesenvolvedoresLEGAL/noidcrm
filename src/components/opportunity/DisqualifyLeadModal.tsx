import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Settings2 } from 'lucide-react';
import {
  DISQUALIFY_REASONS,
  DISQUALIFY_REASON_LABEL,
  type DisqualifyReasonSlug,
} from '@/lib/qualification/disqualifyReasons';
import { findActiveRemarketingDuplicate } from '@/services/crm/disqualify';
import { getDisqualifyReasonsForPipeline } from '@/services/crm/loss-reasons';

export interface DisqualifyLeadDetails {
  /** Stable key — official loss_reasons.id when available, else legacy slug. */
  reasonKey: string;
  /** Official loss_reasons.id when sourced from the official table. */
  reasonId?: string;
  /** Human label for UI / persistence. */
  reasonLabel: string;
  /** Optional category/accountability from the official reason. */
  reasonCategory?: string | null;
  reasonAccountability?: string | null;
  /** @deprecated kept for backwards compat with disqualify.ts and callers. */
  reasonSlug: DisqualifyReasonSlug | string;
  observation: string;
  createRemarketing: boolean;
}

interface DisqualifyLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: DisqualifyLeadDetails) => void;
  opportunityId: string;
  opportunityTitle: string;
  pipelineId?: string | null;
  isLoading?: boolean;
}

export function DisqualifyLeadModal({
  open,
  onClose,
  onConfirm,
  opportunityId,
  opportunityTitle,
  pipelineId,
  isLoading,
}: DisqualifyLeadModalProps) {
  const [reasonKey, setReasonKey] = useState<string>('');
  const [observation, setObservation] = useState('');
  const [createRemarketing, setCreateRemarketing] = useState(true);

  // Official source of truth: Configurações > Motivos de Ganho/Perda
  const { data: officialReasons = [], isLoading: loadingReasons } = useQuery({
    queryKey: ['disqualify-reasons', pipelineId, open],
    queryFn: () => getDisqualifyReasonsForPipeline(pipelineId!),
    enabled: open && !!pipelineId,
    staleTime: 30_000,
  });

  type Opt = {
    key: string;
    label: string;
    reasonId?: string;
    category?: string | null;
    accountability?: string | null;
    sendToRemarketingDefault: boolean;
  };

  const usingOfficial = officialReasons.length > 0;

  const options = useMemo<Opt[]>(() => {
    if (usingOfficial) {
      return officialReasons.map((r) => ({
        key: r.id,
        reasonId: r.id,
        label: r.name,
        category: r.category ?? null,
        accountability: r.loss_accountability ?? null,
        sendToRemarketingDefault: r.send_to_remarketing_default ?? false,
      }));
    }
    // Fallback: hardcoded list (only when org has no reasons configured yet)
    return DISQUALIFY_REASONS.map((r) => ({
      key: r.slug as string,
      label: r.label,
      sendToRemarketingDefault: true,
    }));
  }, [usingOfficial, officialReasons]);

  const { data: existingDup } = useQuery({
    queryKey: ['remarketing-dup', opportunityId, open],
    queryFn: () => findActiveRemarketingDuplicate(opportunityId),
    enabled: open && !!opportunityId,
    staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setReasonKey('');
      setObservation('');
      setCreateRemarketing(true);
    }
  }, [open]);

  useEffect(() => {
    if (existingDup) setCreateRemarketing(false);
  }, [existingDup]);

  useEffect(() => {
    if (!reasonKey || existingDup) return;
    const opt = options.find((o) => o.key === reasonKey);
    if (opt) setCreateRemarketing(opt.sendToRemarketingDefault);
  }, [reasonKey, options, existingDup]);

  const canSubmit = !!reasonKey && !isLoading;

  const handleConfirm = () => {
    if (!reasonKey) return;
    const opt = options.find((o) => o.key === reasonKey);
    const reasonLabel =
      opt?.label ??
      DISQUALIFY_REASON_LABEL[reasonKey as DisqualifyReasonSlug] ??
      reasonKey;
    onConfirm({
      reasonKey,
      reasonId: opt?.reasonId,
      reasonLabel,
      reasonCategory: opt?.category ?? null,
      reasonAccountability: opt?.accountability ?? null,
      reasonSlug: reasonKey,
      observation: observation.trim(),
      createRemarketing: existingDup ? false : createRemarketing,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Desqualificar lead</DialogTitle>
          <DialogDescription>{opportunityTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {existingDup && (
            <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Lead desqualificado e já existente no Remarketing.{' '}
                <a
                  href={`/app/opportunities/${existingDup.id}`}
                  className="underline font-medium"
                >
                  Abrir oportunidade no Remarketing
                </a>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo da desqualificação *</Label>
            <Select value={reasonKey} onValueChange={setReasonKey} disabled={loadingReasons}>
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingReasons ? 'Carregando motivos...' : 'Selecione o motivo'}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usingOfficial ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Settings2 className="h-3 w-3" />
                Motivos definidos em Configurações &gt; Motivos de Ganho/Perda.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Usando lista padrão. Cadastre motivos em{' '}
                <a href="/app/settings/win-loss-reasons" className="underline">
                  Configurações &gt; Motivos de Ganho/Perda
                </a>
                .
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Observação{' '}
              <span className="text-xs text-muted-foreground">(opcional, recomendado)</span>
            </Label>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value.slice(0, 2000))}
              placeholder="Detalhe o contexto da desqualificação..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{observation.length}/2000</p>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Switch
              checked={createRemarketing}
              onCheckedChange={setCreateRemarketing}
              disabled={!!existingDup}
              id="toggle-remarketing"
            />
            <div className="flex-1 -mt-0.5">
              <Label htmlFor="toggle-remarketing" className="cursor-pointer">
                Retornar para remarketing?
              </Label>
              <p className="text-xs text-muted-foreground">
                Sim, criar oportunidade no funil Remarketing
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!canSubmit} variant="destructive">
              {isLoading ? 'Confirmando...' : 'Confirmar desqualificação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
