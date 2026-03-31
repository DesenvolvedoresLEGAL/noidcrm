import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SellerClassificationBannerProps {
  clientReasonName?: string;
  onClassify: () => void;
}

export function SellerClassificationBanner({
  clientReasonName,
  onClassify,
}: SellerClassificationBannerProps) {
  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">Classificação pendente</p>
          <p className="text-sm text-muted-foreground">
            O cliente recusou a proposta.
            {clientReasonName && (
              <> Motivo informado: <strong>{clientReasonName}</strong>.</>
            )}
            {' '}Classifique o motivo real (interno) antes de marcar como perdida.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onClassify}>
          Classificar motivo real
        </Button>
      </div>
    </div>
  );
}
