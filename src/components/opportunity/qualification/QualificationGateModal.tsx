import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  score: number;
  blockers: string[];
}

export function QualificationGateModal({
  open,
  onOpenChange,
  score,
  blockers,
}: Props) {
  const scoreBelow = score < 75;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Lead ainda não pode ir para Vendas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Este lead ainda não atingiu a régua mínima de qualificação da LEGAL.
            Para passar para Vendas, ele precisa ter score mínimo de{' '}
            <strong>75 pontos</strong> e checklist obrigatório completo.
          </p>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Score atual
              </span>
              <span
                className={
                  scoreBelow
                    ? 'text-sm font-bold text-amber-600 dark:text-amber-400'
                    : 'text-sm font-bold text-emerald-600 dark:text-emerald-400'
                }
              >
                {score}/100
              </span>
            </div>

            {blockers.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  Pendências
                </p>
                <ul className="space-y-1">
                  {blockers.map((b) => (
                    <li
                      key={b}
                      className="text-xs text-foreground/90 flex items-start gap-1.5"
                    >
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Voltar para qualificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
