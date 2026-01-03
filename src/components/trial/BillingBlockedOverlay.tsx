import { AlertTriangle, CreditCard, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BillingBlockedOverlayProps {
  billingStatus: {
    payment_status: string;
    blocked_at: string | null;
    block_reason: string | null;
    amount_due: number | null;
    billing_day: number | null;
    next_due_date: string | null;
  } | null;
}

export function BillingBlockedOverlay({ billingStatus }: BillingBlockedOverlayProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="max-w-lg mx-4 border-destructive/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">
            Acesso Suspenso
          </CardTitle>
          <CardDescription className="text-base">
            O acesso da sua organização foi suspenso por pendências financeiras
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Warning Message */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Pagamento não identificado</p>
                <p className="text-muted-foreground mt-1">
                  Conforme os termos de uso, o NOID CRM opera no modelo pré-pago. 
                  O pagamento deve ser realizado até a data de vencimento para manter o acesso.
                </p>
              </div>
            </div>
          </div>

          {/* Amount Due */}
          {billingStatus?.amount_due && billingStatus.amount_due > 0 && (
            <div className="text-center py-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Valor em aberto</p>
              <p className="text-3xl font-bold text-destructive">
                {formatCurrency(billingStatus.amount_due)}
              </p>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Para regularizar o pagamento e restaurar o acesso, entre em contato:
            </p>
            
            <div className="grid grid-cols-1 gap-2">
              <a 
                href="mailto:fala@humanoid-os.ai"
                className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">fala@humanoid-os.ai</span>
              </a>
              
              <a 
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">WhatsApp Comercial</span>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Após a confirmação do pagamento, o acesso será restaurado automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
