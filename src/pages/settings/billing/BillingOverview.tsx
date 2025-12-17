import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyFull } from '@/lib/i18n';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CreditCard, 
  Zap, 
  Users, 
  Target, 
  FileText,
  Calendar,
  ArrowUpRight,
  Sparkles,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  amount: number;
  interval: string;
  current_period_end: string | null;
}

interface UsageMetrics {
  users: { current: number; limit: number | null };
  opportunities: { current: number; limit: number | null };
  contacts: { current: number; limit: number | null };
  pipelines: { current: number; limit: number | null };
}

const PLANS = [
  {
    id: 'neural',
    name: 'Neural',
    price: 19990,
    interval: 'month',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    features: ['10 Usuários', 'Unlimited Opportunities', 'AI Insights', 'Email Integration'],
    recommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49990,
    interval: 'month',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    features: ['25 Usuários', 'Advanced Analytics', 'Custom Workflows', 'Priority Support'],
    recommended: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99990,
    interval: 'month',
    icon: Sparkles,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    features: ['Unlimited Users', 'Dedicated Success Manager', 'Custom Integrations', 'SLA'],
    recommended: false,
  },
];

export default function BillingOverview() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics>({
    users: { current: 0, limit: null },
    opportunities: { current: 0, limit: null },
    contacts: { current: 0, limit: null },
    pipelines: { current: 0, limit: null },
  });
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const loadBillingData = async () => {
      if (!user?.id) return;

      try {
        // Get organization
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!membership?.organization_id) return;
        setOrgId(membership.organization_id);

        // Get subscription
        const { data: sub } = await supabase
          .from('billing_subscriptions')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .eq('status', 'active')
          .maybeSingle();

        if (sub) {
          setSubscription(sub as Subscription);
        }

        // Get usage metrics
        const [usersResult, oppsResult, contactsResult, pipelinesResult] = await Promise.all([
          supabase
            .from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', membership.organization_id)
            .eq('status', 'active'),
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', membership.organization_id),
          supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', membership.organization_id),
          supabase
            .from('pipelines')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', membership.organization_id),
        ]);

        setUsage({
          users: { current: usersResult.count || 0, limit: null },
          opportunities: { current: oppsResult.count || 0, limit: null },
          contacts: { current: contactsResult.count || 0, limit: null },
          pipelines: { current: pipelinesResult.count || 0, limit: null },
        });
      } catch (error) {
        console.error('Error loading billing data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBillingData();
  }, [user?.id]);

  const handleUpgrade = async (planId: string) => {
    try {
      // Call AbacatePay checkout edge function
      const { data, error } = await supabase.functions.invoke('abacatepay-checkout', {
        body: { 
          planId, 
          organizationId: orgId,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Erro ao iniciar checkout');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const currentPlan = PLANS.find(p => p.id === subscription?.plan_id) || PLANS[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Meu Plano</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie sua assinatura e visualize o uso
        </p>
      </div>

      {/* Current Plan & Next Billing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardDescription>Plano Atual</CardDescription>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentPlan.bgColor}`}>
                <currentPlan.icon className={`h-6 w-6 ${currentPlan.color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">{subscription?.plan_name || 'Trial'}</CardTitle>
                <p className="text-lg font-semibold text-primary">
                  {subscription ? formatCurrencyFull(subscription.amount / 100) : 'Grátis'}
                  {subscription && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
              {subscription?.status === 'active' ? 'Ativo' : 'Trial'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Próxima Cobrança</CardDescription>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {subscription?.current_period_end 
                    ? format(new Date(subscription.current_period_end), "dd 'de' MMMM", { locale: ptBR })
                    : '—'
                  }
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {subscription ? formatCurrencyFull(subscription.amount / 100) : 'Sem cobrança pendente'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Ver Fatura
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso do Plano</CardTitle>
          <CardDescription>Recursos utilizados na sua organização</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <UsageCard
              icon={Users}
              label="Usuários"
              current={usage.users.current}
              limit={usage.users.limit}
            />
            <UsageCard
              icon={Target}
              label="Oportunidades"
              current={usage.opportunities.current}
              limit={usage.opportunities.limit}
            />
            <UsageCard
              icon={Users}
              label="Contatos"
              current={usage.contacts.current}
              limit={usage.contacts.limit}
            />
            <UsageCard
              icon={Target}
              label="Pipelines"
              current={usage.pipelines.current}
              limit={usage.pipelines.limit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Planos Disponíveis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === subscription?.plan_id;
            const PlanIcon = plan.icon;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${plan.recommended ? 'border-2 border-primary' : ''} ${isCurrentPlan ? 'bg-accent/30' : ''}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Recomendado</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto p-3 rounded-full ${plan.bgColor} w-fit mb-2`}>
                    <PlanIcon className={`h-6 w-6 ${plan.color}`} />
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{formatCurrencyFull(plan.price / 100)}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isCurrentPlan ? 'Plano Atual' : 'Assinar'}
                    {!isCurrentPlan && <ArrowUpRight className="h-4 w-4 ml-2" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsageCard({ 
  icon: Icon, 
  label, 
  current, 
  limit 
}: { 
  icon: any; 
  label: string; 
  current: number; 
  limit: number | null;
}) {
  const percentage = limit ? Math.min((current / limit) * 100, 100) : 100;
  const isUnlimited = limit === null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">
        {current.toLocaleString()}
        {!isUnlimited && <span className="text-sm font-normal text-muted-foreground">/{limit}</span>}
        {isUnlimited && <span className="text-sm font-normal text-muted-foreground">/∞</span>}
      </div>
      <Progress value={isUnlimited ? 100 : percentage} className="h-2" />
    </div>
  );
}
