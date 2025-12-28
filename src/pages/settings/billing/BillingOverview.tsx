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
  Crown,
  Gift,
  Infinity,
  Check
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

interface Plan {
  id: string;
  name: string;
  price_month_cents: number;
  price_year_cents: number | null;
  features: string[] | null;
  is_public: boolean;
  visible_in_ui: boolean;
  display_order: number | null;
  trial_days: number | null;
}

interface OrgData {
  id: string;
  name: string;
  current_plan_id: string | null;
  is_plan_locked: boolean | null;
  trial_ends_at: string | null;
}

interface SlgConversion {
  mrr_value: number | null;
  proposal_id: string | null;
}

interface ProposalPaymentTerms {
  billing_day: number | null;
  payment_method: string | null;
}

// Configuração visual por plano
const getPlanVisuals = (planId: string) => {
  switch (planId) {
    case 'neural':
      return { icon: Zap, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', emoji: '🧠' };
    case 'autonomous':
      return { icon: Sparkles, color: 'text-primary', bgColor: 'bg-primary/10', emoji: '🤖' };
    case 'internal_full':
      return { icon: Crown, color: 'text-primary', bgColor: 'bg-primary/10', emoji: '👑' };
    case 'freemium':
    case 'free':
    default:
      return { icon: Gift, color: 'text-green-500', bgColor: 'bg-green-500/10', emoji: '🎁' };
  }
};

const getPlanDisplayName = (planId: string | null, planName?: string | null, isPerpetual?: boolean, isManaged?: boolean) => {
  if (isPerpetual) {
    return planName ? `${planName} (Vitalício)` : 'Pro (Vitalício)';
  }
  if (planName) return planName;
  
  switch (planId) {
    case 'neural': return 'Neural';
    case 'autonomous': return 'Autonomous';
    case 'internal_full': return 'Pro (Vitalício)';
    case 'freemium':
    case 'free':
    default: return 'Free';
  }
};

const getPlanTagline = (planId: string | null) => {
  switch (planId) {
    case 'neural': return 'IA Assistiva';
    case 'autonomous': return 'IA Autônoma';
    default: return null;
  }
};

export default function BillingOverview() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [currentPlanData, setCurrentPlanData] = useState<Plan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [slgConversion, setSlgConversion] = useState<SlgConversion | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<ProposalPaymentTerms | null>(null);
  const [usage, setUsage] = useState<UsageMetrics>({
    users: { current: 0, limit: null },
    opportunities: { current: 0, limit: null },
    contacts: { current: 0, limit: null },
    pipelines: { current: 0, limit: null },
  });

  // Licença vitalícia APENAS para internal_full (acesso interno permanente)
  const isPerpetualLicense = orgData?.current_plan_id === 'internal_full';
  
  // Plano gerenciado/travado (via proposta comercial) - não pode trocar, mas NÃO é vitalício
  const isManagedPlan = orgData?.is_plan_locked === true && !isPerpetualLicense;
  
  // Cobrança via proposta (sem subscription no gateway, mas tem slg_conversion)
  const isBilledViaProposal = !subscription && slgConversion !== null;

  useEffect(() => {
    const loadBillingData = async () => {
      if (!user?.id) return;

      try {
        // Get organization membership
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!membership?.organization_id) return;

        // Get organization with plan info
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, current_plan_id, is_plan_locked, trial_ends_at')
          .eq('id', membership.organization_id)
          .single();

        if (org) {
          setOrgData(org as OrgData);
        }

        // Get current plan details from plans table
        if (org?.current_plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('*')
            .eq('id', org.current_plan_id)
            .single();

          if (planData) {
            setCurrentPlanData(planData as Plan);
          }
        }

        // Get available plans (public and visible in UI)
        const { data: plans } = await supabase
          .from('plans')
          .select('*')
          .eq('is_public', true)
          .eq('visible_in_ui', true)
          .order('display_order', { ascending: true });

        if (plans) {
          setAvailablePlans(plans as Plan[]);
        }

        // Get subscription (may not exist for perpetual licenses or proposal-based billing)
        const { data: sub } = await supabase
          .from('billing_subscriptions')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .eq('status', 'active')
          .maybeSingle();

        if (sub) {
          setSubscription(sub as Subscription);
        }

        // Get SLG conversion (to detect proposal-based billing)
        const { data: slgData } = await supabase
          .from('slg_conversions')
          .select('mrr_value, proposal_id')
          .eq('organization_id', membership.organization_id)
          .order('converted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (slgData) {
          setSlgConversion(slgData as SlgConversion);

          // Get payment terms from the proposal
          if (slgData.proposal_id) {
            const { data: termsData } = await supabase
              .from('proposal_payment_terms')
              .select('billing_day, payment_method')
              .eq('proposal_id', slgData.proposal_id)
              .maybeSingle();

            if (termsData) {
              setPaymentTerms(termsData as ProposalPaymentTerms);
            }
          }
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
      const { data, error } = await supabase.functions.invoke('abacatepay-checkout', {
        body: { 
          planId, 
          organizationId: orgData?.id,
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

  // Determine current plan visuals
  const currentPlanId = orgData?.current_plan_id || 'freemium';
  const planVisuals = getPlanVisuals(currentPlanId);
  const PlanIcon = planVisuals.icon;

  // Display name and price
  const displayName = getPlanDisplayName(
    currentPlanId, 
    currentPlanData?.name, 
    isPerpetualLicense,
    isManagedPlan
  );
  const displayPrice = isBilledViaProposal && slgConversion?.mrr_value 
    ? slgConversion.mrr_value 
    : (currentPlanData?.price_month_cents ? currentPlanData.price_month_cents / 100 : 0);
  
  // Calculate next billing date for proposal-based billing
  const getNextBillingDate = () => {
    if (!paymentTerms?.billing_day) return null;
    const today = new Date();
    const billingDay = paymentTerms.billing_day;
    let nextBilling = new Date(today.getFullYear(), today.getMonth(), billingDay);
    if (nextBilling <= today) {
      nextBilling = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
    }
    return nextBilling;
  };
  
  const nextBillingDate = getNextBillingDate();

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
              <div className={`p-2 rounded-lg ${planVisuals.bgColor}`}>
                <PlanIcon className={`h-6 w-6 ${planVisuals.color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">{displayName}</CardTitle>
                <p className="text-lg font-semibold text-primary">
                  {displayPrice > 0 ? (
                    <>
                      {formatCurrencyFull(displayPrice)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Grátis</span>
                  )}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge 
              variant={isPerpetualLicense ? 'default' : (subscription?.status === 'active' || isBilledViaProposal) ? 'default' : 'secondary'}
              className={isPerpetualLicense ? 'bg-primary' : isManagedPlan ? 'bg-emerald-600' : ''}
            >
              {isPerpetualLicense ? (
                <>
                  <Infinity className="h-3 w-3 mr-1" />
                  Vitalício
                </>
              ) : isManagedPlan ? (
                'Ativo (Gerenciado)'
              ) : subscription?.status === 'active' ? (
                'Ativo'
              ) : isBilledViaProposal ? (
                'Ativo (Contrato)'
              ) : (
                'Trial'
              )}
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
                {isPerpetualLicense ? (
                  <>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Infinity className="h-5 w-5" />
                      Licença Vitalícia
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Sem cobranças futuras
                    </p>
                  </>
                ) : subscription?.current_period_end ? (
                  <>
                    <CardTitle className="text-2xl">
                      {format(new Date(subscription.current_period_end), "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrencyFull(subscription.amount / 100)}
                    </p>
                  </>
                ) : isBilledViaProposal && nextBillingDate ? (
                  <>
                    <CardTitle className="text-2xl">
                      Dia {paymentTerms?.billing_day} de cada mês
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {slgConversion?.mrr_value ? formatCurrencyFull(slgConversion.mrr_value) : 'Valor do contrato'}/mês
                    </p>
                  </>
                ) : isBilledViaProposal ? (
                  <>
                    <CardTitle className="text-2xl">
                      Cobrança via contrato
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {slgConversion?.mrr_value ? formatCurrencyFull(slgConversion.mrr_value) : 'Consulte seu contrato'}/mês
                    </p>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl">—</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Sem cobrança pendente
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!isPerpetualLicense && subscription && (
              <Button variant="outline" size="sm" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Ver Fatura
              </Button>
            )}
            {!isPerpetualLicense && isBilledViaProposal && !subscription && (
              <div className="text-sm text-muted-foreground text-center py-2">
                Cobrança gerenciada pelo time comercial
              </div>
            )}
            {isPerpetualLicense && (
              <div className="text-sm text-muted-foreground text-center py-2">
                Você possui acesso completo permanente
              </div>
            )}
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

      {/* Available Plans - Only show if not on perpetual or managed license */}
      {!isPerpetualLicense && !isManagedPlan && availablePlans.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Planos Disponíveis</h3>
          <div className={`grid grid-cols-1 ${availablePlans.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'} gap-4`}>
            {availablePlans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;
              const visuals = getPlanVisuals(plan.id);
              const IconComponent = visuals.icon;
              const isRecommended = plan.id === 'autonomous';
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${isRecommended ? 'border-2 border-primary' : ''} ${isCurrentPlan ? 'bg-accent/30' : ''}`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Recomendado</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto p-3 rounded-full ${visuals.bgColor} w-fit mb-2`}>
                      <IconComponent className={`h-6 w-6 ${visuals.color}`} />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="mt-2">
                      {plan.price_month_cents > 0 ? (
                        <>
                          <span className="text-3xl font-bold">{formatCurrencyFull(plan.price_month_cents / 100)}</span>
                          <span className="text-muted-foreground">/mês</span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold text-muted-foreground">Grátis</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plan.features && plan.features.length > 0 && (
                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                            <Check className="h-3 w-3 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
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
      )}

      {/* Perpetual License Message */}
      {isPerpetualLicense && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Licença Vitalícia Ativa</h3>
                <p className="text-muted-foreground">
                  Você possui acesso completo e permanente a todos os recursos do NOIDCRM. 
                  Não há necessidade de assinatura ou pagamentos futuros.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Managed Plan Message */}
      {isManagedPlan && !isPerpetualLicense && (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <FileText className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Plano Gerenciado</h3>
                <p className="text-muted-foreground">
                  Seu plano foi contratado via proposta comercial e é gerenciado pelo time comercial. 
                  Para alterações, entre em contato com seu representante.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
