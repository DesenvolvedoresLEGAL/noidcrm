import { Contract } from '@/services/crm/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  FileText,
  Building,
  CreditCard,
  RefreshCw,
  User,
  Clock,
  Download,
} from 'lucide-react';

interface ContractDetailModalProps {
  contract: Contract | null;
  open: boolean;
  onClose: () => void;
}

export function ContractDetailModal({ contract, open, onClose }: ContractDetailModalProps) {
  if (!contract) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: Contract['status']) => {
    const statusMap = {
      draft: { label: 'Rascunho', variant: 'outline' as const },
      pending: { label: 'Pendente', variant: 'secondary' as const },
      active: { label: 'Ativo', variant: 'default' as const },
      expiring: { label: 'Expirando', variant: 'destructive' as const },
      expired: { label: 'Expirado', variant: 'outline' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
      renewed: { label: 'Renovado', variant: 'default' as const },
    };
    const config = statusMap[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: Contract['type']) => {
    const typeMap = {
      monthly: 'Mensal',
      quarterly: 'Trimestral',
      annual: 'Anual',
      'one-time': 'Pagamento Único',
    };
    return typeMap[type];
  };

  const getPaymentMethodLabel = (method: Contract['paymentMethod']) => {
    const methodMap = {
      credit_card: 'Cartão de Crédito',
      bank_slip: 'Boleto Bancário',
      bank_transfer: 'Transferência Bancária',
      pix: 'PIX',
    };
    return methodMap[method];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{contract.clientName}</DialogTitle>
              <DialogDescription className="mt-1">
                Contrato #{contract.id}
              </DialogDescription>
            </div>
            {getStatusBadge(contract.status)}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Building className="h-4 w-4" />
              INFORMAÇÕES DO CLIENTE
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Documento</p>
                <p className="font-medium">{contract.clientDocument}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{contract.clientEmail}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Valores */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              VALORES
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(contract.value)}</p>
              </div>
              {contract.monthlyValue && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor Mensal</p>
                  <p className="text-2xl font-bold">{formatCurrency(contract.monthlyValue)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Contrato</p>
                <p className="font-medium">{getTypeLabel(contract.type)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                <p className="font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {getPaymentMethodLabel(contract.paymentMethod)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              DATAS
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data de Início</p>
                <p className="font-medium">{formatDate(contract.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Término</p>
                <p className="font-medium">{formatDate(contract.endDate)}</p>
              </div>
              {contract.signedDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Data de Assinatura</p>
                  <p className="font-medium">{formatDate(contract.signedDate)}</p>
                </div>
              )}
              {contract.renewalDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Data de Renovação</p>
                  <p className="font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    {formatDate(contract.renewalDate)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Renovação Automática</p>
              <Badge variant={contract.autoRenewal ? 'default' : 'outline'}>
                {contract.autoRenewal ? 'Sim' : 'Não'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Termos e Observações */}
          {(contract.terms || contract.notes) && (
            <>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  TERMOS E OBSERVAÇÕES
                </h3>
                {contract.terms && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground">Termos do Contrato</p>
                    <p className="text-sm">{contract.terms}</p>
                  </div>
                )}
                {contract.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="text-sm">{contract.notes}</p>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Anexos */}
          {contract.attachments && contract.attachments.length > 0 && (
            <>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  ANEXOS
                </h3>
                <div className="space-y-2">
                  {contract.attachments.map((attachment, index) => (
                    <Button key={index} variant="outline" className="w-full justify-start" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      {attachment}
                    </Button>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Metadados */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              METADADOS
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Criado por</p>
                <p className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {contract.createdBy}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Criado em</p>
                <p>{format(new Date(contract.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Última atualização</p>
                <p>{format(new Date(contract.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          <Button className="flex-1">Editar Contrato</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
