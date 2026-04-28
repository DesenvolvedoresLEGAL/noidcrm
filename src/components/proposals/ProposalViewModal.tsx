import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Eye, FileText } from 'lucide-react';
import { useState } from 'react';
import { formatDateBR } from '@/lib/dateUtils';
import { ProposalEmailComposer } from './ProposalEmailComposer';

interface ProposalViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
}

export function ProposalViewModal({ open, onOpenChange, proposal }: ProposalViewModalProps) {
  const [emailOpen, setEmailOpen] = useState(false);

  if (!proposal) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      sent: { variant: 'default', label: 'Aberta' },
      viewed: { variant: 'outline', label: 'Aberta · Visualizada' },
      accepted: { variant: 'default', label: 'Aceita' },
      rejected: { variant: 'destructive', label: 'Recusada' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <>
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
                      {proposal.total_amount != null ? `R$ ${proposal.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
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

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="default" onClick={() => setEmailOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Enviar por E-mail
              </Button>
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

      {proposal.opportunity_id && (
        <ProposalEmailComposer
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          onSent={() => {}}
          proposalId={proposal.id}
          opportunityId={proposal.opportunity_id}
        />
      )}
    </>
  );
}
