import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProposalEditorHeaderProps {
  proposalNumber: string;
  version: number;
  status: string;
  isNew: boolean;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'default' },
  viewed: { label: 'Visualizada', variant: 'outline' },
  accepted: { label: 'Aceita', variant: 'default' },
  rejected: { label: 'Recusada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'destructive' },
};

export function ProposalEditorHeader({ 
  proposalNumber, 
  version, 
  status, 
  isNew,
  onBack 
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
              {!isNew && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusInfo.variant} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Versão {version}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
