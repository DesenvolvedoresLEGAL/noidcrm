import { 
  ArrowLeft, 
  Save, 
  FileDown, 
  Link as LinkIcon, 
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
import { duplicateProposal, sendProposalEmail } from '@/services/crm/proposals';
import { useQueryClient } from '@tanstack/react-query';

interface ProposalActionsBarProps {
  onBack: () => void;
  onSave: () => void;
  onGeneratePDF: () => void;
  onGenerateLink: () => void;
  isSaving: boolean;
  isGeneratingPDF: boolean;
  hasPublicToken: boolean;
  proposalId?: string;
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
}: ProposalActionsBarProps) {
  const queryClient = useQueryClient();

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
    // For now, show a message that this feature needs client email
    toast.info('Para enviar por email, preencha o email do cliente no conteúdo da proposta.');
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

          {/* Public Link */}
          <Button 
            variant="outline" 
            onClick={onGenerateLink}
            disabled={!proposalId}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            {hasPublicToken ? 'Copiar Link' : 'Gerar Link'}
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

          {/* Save Button */}
          <Button 
            onClick={onSave} 
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 text-white"
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
