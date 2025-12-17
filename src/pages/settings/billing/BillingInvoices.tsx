import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyFull } from '@/lib/i18n';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Receipt, 
  Download,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string | null;
  description: string | null;
  amount: number;
  status: string;
  paid_at: string | null;
  due_date: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
}

export default function BillingInvoices() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!user?.id) return;

      try {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!membership?.organization_id) return;

        const { data } = await supabase
          .from('billing_invoices')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .order('created_at', { ascending: false });

        if (data) {
          setInvoices(data as Invoice[]);
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [user?.id]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      paid: { label: 'Pago', variant: 'default', icon: CheckCircle2 },
      pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
      failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
      refunded: { label: 'Reembolsado', variant: 'outline', icon: RefreshCw },
      canceled: { label: 'Cancelado', variant: 'outline', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Faturas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de cobranças e pagamentos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Faturas
          </CardTitle>
          <CardDescription>
            Todas as suas faturas e pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                As faturas aparecerão aqui após a primeira cobrança
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium">
                          {format(new Date(invoice.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        {invoice.invoice_number && (
                          <div className="text-xs text-muted-foreground">
                            #{invoice.invoice_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">{invoice.description || 'Assinatura'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium">
                          {formatCurrencyFull(invoice.amount / 100)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {invoice.invoice_pdf_url ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(invoice.invoice_pdf_url!, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            <FileText className="h-4 w-4 mr-2" />
                            Indisponível
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
