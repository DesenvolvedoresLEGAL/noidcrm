import { 
  ArrowLeft, 
  Save, 
  FileDown, 
  ExternalLink, 
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generatePublicToken } from '@/services/crm/proposals';
import { buildProposalPublicUrl, buildProposalDirectUrl } from '@/lib/proposalUrl';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { proposalKeys } from '@/lib/query-keys';

interface ProposalActionsBarProps {
  onBack: () => void;
  onSave: () => void;
  onGeneratePDF: () => void;
  onGenerateLink: () => void;
  isSaving: boolean;
  isGeneratingPDF: boolean;
  hasPublicToken: boolean;
  proposalId?: string;
  publicToken?: string;
}

export function ProposalActionsBar({
  onBack,
  onSave,
  onGeneratePDF,
  onGenerateLink,
  isSaving,
  isGeneratingPDF,
  hasPublicToken,
  proposalId,
  publicToken,
}: ProposalActionsBarProps) {
  const queryClient = useQueryClient();
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const handleQuickView = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de gerar o link.');
      return;
    }

    setIsGeneratingLink(true);
    try {
      let token = publicToken;
      
      // Generate token if doesn't exist
      if (!hasPublicToken || !token) {
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

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="flex items-center justify-between px-6 py-3 max-w-screen-2xl mx-auto">
        {/* Left side */}
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Right side */}
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

          {/* Save Button - using primary color */}
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