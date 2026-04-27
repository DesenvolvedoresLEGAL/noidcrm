import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

interface EnrichProspectButtonProps {
  hasRun: boolean;
  isLoading: boolean;
  onClick: () => void;
  onForceFallback?: () => void;
}

export function EnrichProspectButton({ hasRun, isLoading, onClick, onForceFallback }: EnrichProspectButtonProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Button onClick={onClick} disabled={isLoading} className="w-full gap-2" variant={hasRun ? 'outline' : 'default'}>
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isLoading ? 'Enriquecendo...' : hasRun ? 'Enriquecer novamente' : 'Enriquecer com IA'}
      </Button>
      {hasRun && onForceFallback && (
        <Button
          onClick={onForceFallback}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Forçar fallback + reprocessar
        </Button>
      )}
    </div>
  );
}
