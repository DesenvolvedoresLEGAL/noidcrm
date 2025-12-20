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
import { AlertTriangle, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemCount?: number;
  itemsList?: string[];
  confirmText?: string;
  requireTyping?: boolean;
  delaySeconds?: number;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirmar exclusão',
  description = 'Esta ação não pode ser desfeita.',
  itemCount = 1,
  itemsList = [],
  confirmText = 'DELETAR',
  requireTyping = false,
  delaySeconds = 0,
  isLoading = false,
}: DeleteConfirmationDialogProps) {
  const [typedText, setTypedText] = useState('');
  const [countdown, setCountdown] = useState(delaySeconds);
  const [canConfirm, setCanConfirm] = useState(false);

  // Determine if we need enhanced confirmation (mass deletion)
  const isMassDeletion = itemCount >= 5;
  const actualRequireTyping = requireTyping || isMassDeletion;
  const actualDelaySeconds = delaySeconds || (isMassDeletion ? 5 : 0);

  useEffect(() => {
    if (open) {
      setTypedText('');
      setCountdown(actualDelaySeconds);
      setCanConfirm(actualDelaySeconds === 0 && !actualRequireTyping);
    }
  }, [open, actualDelaySeconds, actualRequireTyping]);

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

  useEffect(() => {
    const typingValid = !actualRequireTyping || typedText.toUpperCase() === confirmText;
    const delayValid = countdown === 0;
    setCanConfirm(typingValid && delayValid);
  }, [typedText, countdown, actualRequireTyping, confirmText]);

  const handleConfirm = () => {
    if (canConfirm && !isLoading) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              isMassDeletion ? "bg-destructive/20" : "bg-warning/20"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                isMassDeletion ? "text-destructive" : "text-warning"
              )} />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Item count warning */}
          {itemCount > 1 && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg border",
              isMassDeletion 
                ? "bg-destructive/10 border-destructive/30" 
                : "bg-muted border-border"
            )}>
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">
                {itemCount} itens serão excluídos permanentemente
              </span>
            </div>
          )}

          {/* Items list preview */}
          {itemsList.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Itens a serem excluídos:
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted/50 rounded-md border">
                {itemsList.slice(0, 10).map((item, index) => (
                  <div key={index} className="text-sm text-muted-foreground truncate">
                    • {item}
                  </div>
                ))}
                {itemsList.length > 10 && (
                  <div className="text-sm text-muted-foreground italic">
                    ... e mais {itemsList.length - 10} itens
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Typing confirmation */}
          {actualRequireTyping && (
            <div className="space-y-2">
              <Label htmlFor="confirm-text" className="text-sm">
                Digite <span className="font-mono font-bold text-destructive">{confirmText}</span> para confirmar:
              </Label>
              <Input
                id="confirm-text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={confirmText}
                className={cn(
                  "font-mono",
                  typedText.toUpperCase() === confirmText && "border-green-500 focus-visible:ring-green-500"
                )}
                autoComplete="off"
              />
            </div>
          )}

          {/* Countdown */}
          {countdown > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Aguarde {countdown} segundos antes de confirmar...</span>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              (!canConfirm || isLoading) && "opacity-50 cursor-not-allowed"
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
                Excluir {itemCount > 1 ? `${itemCount} itens` : ''}
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
