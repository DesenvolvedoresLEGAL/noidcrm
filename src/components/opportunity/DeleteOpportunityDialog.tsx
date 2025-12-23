import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  opportunityTitle: string;
  isLoading?: boolean;
}

export function DeleteOpportunityDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunityTitle,
  isLoading = false,
}: DeleteOpportunityDialogProps) {
  const [typedText, setTypedText] = useState('');
  const [countdown, setCountdown] = useState(3);

  const normalizedTitle = opportunityTitle.trim().toLowerCase();
  const normalizedTyped = typedText.trim().toLowerCase();
  const isTypingValid = normalizedTyped === normalizedTitle;
  const canConfirm = isTypingValid && countdown === 0 && !isLoading;

  useEffect(() => {
    if (open) {
      setTypedText('');
      setCountdown(3);
    }
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, countdown]);

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Confirmar exclusão da oportunidade</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 space-y-2">
            <p>
              Você está prestes a excluir a oportunidade{' '}
              <strong className="text-foreground">"{opportunityTitle}"</strong>.
            </p>
            <p className="text-destructive font-medium">
              Esta ação é permanente e não pode ser desfeita facilmente.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning box */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-destructive/10 border-destructive/30">
            <Trash2 className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Atenção!</p>
              <p className="text-muted-foreground mt-1">
                Todos os dados relacionados (notas, arquivos, atividades) serão movidos para a lixeira.
              </p>
            </div>
          </div>

          {/* Typing confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm">
              Digite o nome da oportunidade para confirmar:
            </Label>
            <Input
              id="confirm-text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={opportunityTitle}
              className={cn(
                "font-medium",
                isTypingValid && "border-green-500 focus-visible:ring-green-500"
              )}
              autoComplete="off"
              autoFocus
            />
            {typedText.length > 0 && !isTypingValid && (
              <p className="text-xs text-destructive">
                O nome digitado não corresponde à oportunidade
              </p>
            )}
          </div>

          {/* Countdown */}
          {countdown > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-mono">
                {countdown}
              </span>
              <span>Aguarde {countdown} segundo{countdown > 1 ? 's' : ''} antes de confirmar...</span>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              !canConfirm && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Excluindo...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Excluir Oportunidade
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
