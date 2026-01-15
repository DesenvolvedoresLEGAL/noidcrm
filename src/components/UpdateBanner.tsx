import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersion } from '@/hooks/useAppVersion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface UpdateBannerProps {
  className?: string;
}

/**
 * Banner that shows when a new app version is available
 * Prompts users to update to avoid cache issues
 */
export function UpdateBanner({ className }: UpdateBannerProps) {
  const { needsUpdate, isChecking, performUpdate } = useAppVersion();
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!needsUpdate || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await performUpdate();
    } catch (error) {
      console.error('Failed to update:', error);
      setIsUpdating(false);
    }
  };

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground py-2 px-4",
        "flex items-center justify-center gap-4 shadow-lg animate-in slide-in-from-top duration-300",
        className
      )}
    >
      <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
      <span className="text-sm font-medium">
        Nova versão disponível! Atualize para a melhor experiência.
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleUpdate}
        disabled={isUpdating}
        className="h-7 px-3 text-xs"
      >
        {isUpdating ? (
          <>
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Atualizando...
          </>
        ) : (
          'Atualizar agora'
        )}
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-primary-foreground/20 rounded-full transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
