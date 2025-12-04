import { useState } from 'react';
import { ArrowLeft, FileText, Save, FileDown, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generatePublicToken } from '@/services/crm/proposals';
import { useQueryClient } from '@tanstack/react-query';

interface ProposalEditorHeaderProps {
  proposalNumber: string;
  version: number;
  status: string;
  isNew: boolean;
  onBack: () => void;
  onSave: () => void;
  onGeneratePDF: () => void;
  isSaving: boolean;
  isGeneratingPDF: boolean;
  proposalId?: string;
  publicToken?: string | null;
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
  onSave,
  onGeneratePDF,
  isSaving,
  isGeneratingPDF,
  proposalId,
  publicToken,
  lastSaved
}: ProposalEditorHeaderProps) {
  const queryClient = useQueryClient();
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const statusInfo = statusConfig[status] || statusConfig.draft;

  const handleQuickView = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de gerar o link.');
      return;
    }

    setIsGeneratingLink(true);
    try {
      let token = publicToken;
      
      // Generate token if doesn't exist
      if (!token) {
        token = await generatePublicToken(proposalId);
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
      }

      // Build the public URL
      const publicUrl = `${window.location.origin}/p/${token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado! Abrindo visualização...');
      
      // Open in new tab
      window.open(publicUrl, '_blank');
    } catch (error) {
      console.error('Error generating quick view:', error);
      toast.error('Erro ao gerar link de visualização.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

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
              {/* Auto-save indicator */}
              {lastSaved && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Save className="h-3 w-3" />
                  <span>Rascunho salvo {formatLastSaved(lastSaved)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons on the right */}
        <div className="flex items-center gap-2">
          {/* Generate PDF */}
          <Button 
            variant="outline" 
            onClick={onGeneratePDF}
            disabled={isGeneratingPDF || !proposalId}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Gerar PDF
          </Button>

          {/* Quick View - copies link and opens in new tab */}
          <Button 
            variant="outline" 
            onClick={handleQuickView}
            disabled={!proposalId || isGeneratingLink}
          >
            {isGeneratingLink ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Visualização Rápida
          </Button>

          {/* Save Button */}
          <Button 
            onClick={onSave} 
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
