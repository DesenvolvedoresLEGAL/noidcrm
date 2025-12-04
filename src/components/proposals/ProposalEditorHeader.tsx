import { ArrowLeft, FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProposalEditorHeaderProps {
  proposalNumber: string;
  version: number;
  status: string;
  isNew: boolean;
  onBack: () => void;
  lastSaved?: Date | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'default' },
  viewed: { label: 'Visualizada', variant: 'outline' },
  accepted: { label: 'Aceita', variant: 'default' },
  rejected: { label: 'Recusada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'destructive' },
};

function formatLastSaved(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 5) return 'agora';
  if (diffSec < 60) return `há ${diffSec}s`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin}min`;
  
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ProposalEditorHeader({ 
  proposalNumber, 
  version, 
  status, 
  isNew,
  onBack,
  lastSaved
}: ProposalEditorHeaderProps) {
  const statusInfo = statusConfig[status] || statusConfig.draft;

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {isNew ? 'Nova Proposta' : 'Editar Proposta'}
                </h1>
                {proposalNumber && (
                  <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {proposalNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-save indicator */}
        {lastSaved && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className="h-3.5 w-3.5" />
            <span>Rascunho salvo {formatLastSaved(lastSaved)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
