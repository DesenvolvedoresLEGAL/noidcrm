import { 
  ArrowLeft, 
  Save, 
  FileDown, 
  ExternalLink, 
  Send, 
  Copy, 
  MoreHorizontal,
  Loader2,
  Trash2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { duplicateProposal, generatePublicToken } from '@/services/crm/proposals';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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

  const handleDuplicate = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de duplicar.');
      return;
    }
    try {
      await duplicateProposal(proposalId);
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposta duplicada!');
    } catch (error) {
      console.error('Error duplicating proposal:', error);
      toast.error('Erro ao duplicar proposta.');
    }
  };

  const handleSendEmail = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de enviar por email.');
      return;
    }
    toast.info('Para enviar por email, preencha o email do cliente no conteúdo da proposta.');
  };

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

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSendEmail}>
                <Send className="h-4 w-4 mr-2" />
                Enviar por Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar Proposta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar como Aceita
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <XCircle className="h-4 w-4 mr-2" />
                Marcar como Recusada
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Proposta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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