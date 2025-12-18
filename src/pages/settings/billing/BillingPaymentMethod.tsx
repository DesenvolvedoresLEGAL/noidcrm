import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Trash2,
  Check,
  Wallet,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  type: string;
  is_default: boolean;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  billing_name: string | null;
  billing_email: string | null;
}

const CARD_BRANDS: Record<string, { name: string; color: string }> = {
  visa: { name: 'Visa', color: 'bg-blue-500' },
  mastercard: { name: 'Mastercard', color: 'bg-orange-500' },
  amex: { name: 'American Express', color: 'bg-blue-600' },
  elo: { name: 'Elo', color: 'bg-yellow-500' },
  hipercard: { name: 'Hipercard', color: 'bg-red-500' },
};

export default function BillingPaymentMethod() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      if (!user?.id) return;

      try {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!membership?.organization_id) return;
        setOrgId(membership.organization_id);

        const { data } = await supabase
          .from('billing_payment_methods')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .order('is_default', { ascending: false });

        if (data) {
          setPaymentMethods(data as PaymentMethod[]);
        }
      } catch (error) {
        console.error('Error loading payment methods:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPaymentMethods();
  }, [user?.id]);

  const handleSetDefault = async (methodId: string) => {
    if (!orgId) return;

    try {
      // First, unset all defaults
      await supabase
        .from('billing_payment_methods')
        .update({ is_default: false })
        .eq('organization_id', orgId);

      // Then set the new default
      await supabase
        .from('billing_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      // Update local state
      setPaymentMethods(prev => 
        prev.map(pm => ({
          ...pm,
          is_default: pm.id === methodId,
        }))
      );

      toast.success('Método de pagamento padrão atualizado');
    } catch (error) {
      console.error('Error setting default payment method:', error);
      toast.error('Erro ao atualizar método de pagamento');
    }
  };

  const handleDelete = async (methodId: string) => {
    try {
      await supabase
        .from('billing_payment_methods')
        .delete()
        .eq('id', methodId);

      setPaymentMethods(prev => prev.filter(pm => pm.id !== methodId));
      toast.success('Método de pagamento removido');
    } catch (error) {
      console.error('Error deleting payment method:', error);
      toast.error('Erro ao remover método de pagamento');
    }
  };

  const getCardIcon = (brand: string | null) => {
    const brandConfig = brand ? CARD_BRANDS[brand.toLowerCase()] : null;
    if (!brandConfig) return null;
    
    return (
      <div className={`${brandConfig.color} text-white text-xs font-bold px-2 py-1 rounded`}>
        {brandConfig.name}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Método de Pagamento</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seus métodos de pagamento
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Métodos de Pagamento
          </CardTitle>
          <CardDescription>
            Cartões e formas de pagamento cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum método de pagamento cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Seu método de pagamento será cadastrado automaticamente quando você assinar um plano.
              </p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/app/settings/billing')}
              >
                Ver Planos Disponíveis
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {getCardIcon(method.card_brand)}
                        <span className="font-medium">
                          •••• {method.card_last4 || '****'}
                        </span>
                        {method.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" />
                            Padrão
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {method.card_exp_month && method.card_exp_year && (
                          <span>Expira {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}</span>
                        )}
                        {method.billing_name && (
                          <span className="ml-2">• {method.billing_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Definir Padrão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Pagamentos Seguros</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os pagamentos são processados de forma segura através do AbacatePay.
                Seus dados de cartão são criptografados e nunca armazenados em nossos servidores.
                Seu método de pagamento é registrado automaticamente ao realizar uma assinatura.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
