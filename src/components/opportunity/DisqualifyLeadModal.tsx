import { useEffect, useState } from 'react';
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
import { AlertCircle } from 'lucide-react';
import {
  DISQUALIFY_REASONS,
  type DisqualifyReasonSlug,
} from '@/lib/qualification/disqualifyReasons';
import { findActiveRemarketingDuplicate } from '@/services/crm/disqualify';

export interface DisqualifyLeadDetails {
  reasonSlug: DisqualifyReasonSlug;
  observation: string;
  createRemarketing: boolean;
}

interface DisqualifyLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: DisqualifyLeadDetails) => void;
  opportunityId: string;
  opportunityTitle: string;
  isLoading?: boolean;
}

export function DisqualifyLeadModal({
  open,
  onClose,
  onConfirm,
  opportunityId,
  opportunityTitle,
  isLoading,
}: DisqualifyLeadModalProps) {
  const [reasonSlug, setReasonSlug] = useState<DisqualifyReasonSlug | ''>('');
  const [observation, setObservation] = useState('');
  const [createRemarketing, setCreateRemarketing] = useState(true);

  // Pre-check if a remarketing duplicate already exists
  const { data: existingDup } = useQuery({
    queryKey: ['remarketing-dup', opportunityId, open],
    queryFn: () => findActiveRemarketingDuplicate(opportunityId),
    enabled: open && !!opportunityId,
    staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setReasonSlug('');
      setObservation('');
      setCreateRemarketing(true);
    }
  }, [open]);

  useEffect(() => {
    if (existingDup) setCreateRemarketing(false);
  }, [existingDup]);

  const canSubmit = !!reasonSlug && !isLoading;

  const handleConfirm = () => {
    if (!reasonSlug) return;
    onConfirm({
      reasonSlug: reasonSlug as DisqualifyReasonSlug,
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
            <Select
              value={reasonSlug}
              onValueChange={(v) => setReasonSlug(v as DisqualifyReasonSlug)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {DISQUALIFY_REASONS.map((opt) => (
                  <SelectItem key={opt.slug} value={opt.slug}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button
              onClick={handleConfirm}
              disabled={!canSubmit}
              variant="destructive"
            >
              {isLoading ? 'Confirmando...' : 'Confirmar desqualificação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
