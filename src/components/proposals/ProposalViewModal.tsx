import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Send, Eye, FileText } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendProposalEmail } from '@/services/supabase/proposals';
import { formatDateBR } from '@/lib/dateUtils';

interface ProposalViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
}

export function ProposalViewModal({ open, onOpenChange, proposal }: ProposalViewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState(proposal?.client_email || '');
  const [recipientName, setRecipientName] = useState(proposal?.client_name || '');

  const sendMutation = useMutation({
    mutationFn: () => sendProposalEmail(proposal.id, recipientEmail, recipientName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Proposta enviada por email!' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: error.message });
    },
  });

  if (!proposal) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      sent: { variant: 'default', label: 'Enviada' },
      viewed: { variant: 'outline', label: 'Visualizada' },
      accepted: { variant: 'default', label: 'Aceita' },
      rejected: { variant: 'destructive', label: 'Rejeitada' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{proposal.title || 'Proposta'}</span>
            {getStatusBadge(proposal.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{proposal.client_name || proposal.opportunity?.account?.razao_social || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-medium text-lg">
                    {proposal.value ? `R$ ${proposal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Criada em</p>
                  <p className="font-medium">{formatDateBR(proposal.created_at)}</p>
                </div>
                {proposal.expires_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Válida até</p>
                    <p className="font-medium">{formatDateBR(proposal.expires_at)}</p>
                  </div>
                )}
                {proposal.sent_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Enviada em</p>
                    <p className="font-medium">{formatDateBR(proposal.sent_at)}</p>
                  </div>
                )}
                {proposal.viewed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Visualizada em</p>
                    <p className="font-medium">{formatDateBR(proposal.viewed_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Preview */}
          {proposal.content && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {proposal.content.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{proposal.content.description}</p>
                  </div>
                )}
                {proposal.content.terms && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Termos e Condições</p>
                    <p className="text-sm whitespace-pre-wrap">{proposal.content.terms}</p>
                  </div>
                )}
                {proposal.content.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{proposal.content.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Send Email Section */}
          {proposal.pdf_url && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-4">Enviar por Email</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="recipientName">Nome do Destinatário</Label>
                    <Input
                      id="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientEmail">Email do Destinatário</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="email@cliente.com"
                    />
                  </div>
                  <Button
                    onClick={() => sendMutation.mutate()}
                    disabled={!recipientEmail || sendMutation.isPending}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMutation.isPending ? 'Enviando...' : 'Enviar Proposta'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {proposal.pdf_url && (
              <Button variant="outline" onClick={() => window.open(proposal.pdf_url, '_blank')}>
                <Eye className="h-4 w-4 mr-2" />
                Ver PDF
              </Button>
            )}
            {proposal.pdf_url && (
              <Button variant="outline" onClick={() => window.open(proposal.pdf_url, '_blank')}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
