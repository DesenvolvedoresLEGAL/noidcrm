import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw } from 'lucide-react';

interface EnrichProspectButtonProps {
  hasRun: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function EnrichProspectButton({ hasRun, isLoading, onClick }: EnrichProspectButtonProps) {
  return (
    <Button onClick={onClick} disabled={isLoading} className="w-full gap-2" variant={hasRun ? 'outline' : 'default'}>
      {isLoading ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {isLoading ? 'Enriquecendo...' : hasRun ? 'Enriquecer novamente' : 'Enriquecer com IA'}
    </Button>
  );
}
