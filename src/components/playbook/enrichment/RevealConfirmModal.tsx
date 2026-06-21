import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { RevealDataType } from '@/services/intelligence/apolloInvisible';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => Promise<unknown> | void;
  isRunning?: boolean;
  contactName?: string | null;
  companyName?: string | null;
  requestedDataType: RevealDataType;
  emailStatus?: string | null;
  phoneStatus?: string | null;
}

const CREDITS: Record<RevealDataType, number> = {
  profile_only: 0,
  email: 1,
  phone: 1,
  both: 2,
};

const LABEL: Record<RevealDataType, string> = {
  profile_only: 'Perfil',
  email: 'E-mail',
  phone: 'Telefone',
  both: 'E-mail e telefone',
};

export function RevealConfirmModal({
  open, onOpenChange, onConfirm, isRunning,
  contactName, companyName, requestedDataType, emailStatus, phoneStatus,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const credits = CREDITS[requestedDataType];

  const handle = async () => {
    setSubmitting(true);
    try { await onConfirm(); onOpenChange(false); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && !isRunning && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revelar dado via Apollo</DialogTitle>
          <DialogDescription>
            Confirme a revelação seletiva — apenas o dado solicitado consumirá crédito.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contato</span>
            <span className="font-medium">{contactName ?? '—'}</span>
          </div>
          {companyName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-medium">{companyName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dado solicitado</span>
            <Badge variant="secondary">{LABEL[requestedDataType]}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Créditos estimados</span>
            <span className="font-mono font-semibold">{credits}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Status atual</span>
            <span>
              📧 {emailStatus ?? 'not_requested'} · 📞 {phoneStatus ?? 'not_requested'}
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <span>Esta ação consome créditos Apollo da sua organização e não pode ser desfeita.</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting || isRunning}>
            Cancelar
          </Button>
          <Button onClick={handle} disabled={submitting || isRunning}>
            {(submitting || isRunning) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Confirmar revelação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
