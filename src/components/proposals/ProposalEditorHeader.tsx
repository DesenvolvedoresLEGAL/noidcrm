import { useState } from 'react';
import { ArrowLeft, FileText, Save, FileDown, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { generatePublicToken, reopenProposal } from '@/services/crm/proposals';
import { buildProposalPublicUrl, buildProposalDirectUrl } from '@/lib/proposalUrl';
import { useQueryClient } from '@tanstack/react-query';
import { proposalKeys } from '@/lib/query-keys';

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
  sent: { label: 'Aberta', variant: 'default' },
  viewed: { label: 'Aberta · Visualizada', variant: 'outline' },
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
  const [isReopening, setIsReopening] = useState(false);
  const statusInfo = statusConfig[status] || statusConfig.draft;
  const isTerminal = status === 'accepted' || status === 'rejected';

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
        queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      }

      const shareUrl = buildProposalPublicUrl(token);
      const directUrl = buildProposalDirectUrl(token);
      
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado! Abrindo visualização...');
      
      window.open(directUrl, '_blank');
    } catch (error) {
      console.error('Error generating quick view:', error);
      toast.error('Erro ao gerar link de visualização.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleReopen = async () => {
    if (!proposalId) return;
    const confirmMsg = status === 'accepted'
      ? 'Reabrir esta proposta? Ela voltará ao status "Aberta" e o registro de aceite será limpo.'
      : 'Reabrir esta proposta? Ela voltará ao status "Aberta" e o registro de recusa será limpo.';
    if (!window.confirm(confirmMsg)) return;

    setIsReopening(true);
    try {
      await reopenProposal(proposalId);
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      toast.success('Proposta reaberta. Status atualizado para "Aberta".');
    } catch (error) {
      console.error('Error reopening proposal:', error);
      toast.error('Erro ao reabrir proposta.');
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
        {/* Top row: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base md:text-xl font-semibold truncate">
                  {isNew ? 'Nova Proposta' : 'Editar Proposta'}
                </h1>
                {proposalNumber && (
                  <span className="font-mono text-xs md:text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {proposalNumber}
                  </span>
                )}
                {!isNew && (
                  <Badge variant={statusInfo.variant} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
              {lastSaved && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Save className="h-3 w-3" />
                  <span>Salvo {formatLastSaved(lastSaved)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-11 md:ml-0">
          {isTerminal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopen}
              disabled={isReopening || !proposalId}
              title='Reabrir proposta (volta para "Aberta")'
            >
              {isReopening ? (
                <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Reabrir Proposta</span>
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm"
            onClick={onGeneratePDF}
            disabled={isGeneratingPDF || !proposalId}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
            ) : (
              <FileDown className="h-4 w-4 md:mr-2" />
            )}
            <span className="hidden md:inline">Gerar PDF</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleQuickView}
            disabled={!proposalId || isGeneratingLink}
          >
            {isGeneratingLink ? (
              <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 md:mr-2" />
            )}
            <span className="hidden md:inline">Visualização Rápida</span>
          </Button>

          <Button 
            size="sm"
            onClick={onSave} 
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
            ) : (
              <Save className="h-4 w-4 md:mr-2" />
            )}
            <span className="hidden md:inline">Salvar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
