import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Step1Company, Step1Data } from '@/components/onboarding/Step1Company';
import { Step2Workspace, Step2Data } from '@/components/onboarding/Step2Workspace';
import { Step3Pipeline } from '@/components/onboarding/Step3Pipeline';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const { user, session } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin: hasAdminRole, loading: rolesLoading } = useUserRole();
  const { isAdmin: isOrgAdmin, isOwner, loading: orgLoading } = useCurrentOrganization();

  // Redirect to login if not authenticated
  if (!user && !session) {
    navigate('/login');
    return null;
  }

  // Guard: somente owner/admin pode ver onboarding
  if (!rolesLoading && !orgLoading) {
    const canOnboard = isOwner || isOrgAdmin || hasAdminRole;
    if (!canOnboard) {
      navigate('/app/dashboard');
      return null;
    }
  }

  const handleStep1Next = (data: Step1Data) => {
    setStep1Data(data);
    setCurrentStep(2);
  };

  const handleStep2Next = (data: Step2Data) => {
    setStep2Data(data);
    setCurrentStep(3);
  };

  const handleStep3Next = async (pipelineType: 'b2b' | 'b2c' | 'enterprise' | 'custom') => {
    if (!user || !step1Data || !step2Data) {
      console.error('[ONBOARDING] Dados incompletos:', {
        hasUser: !!user,
        hasStep1: !!step1Data,
        hasStep2: !!step2Data,
      });
      toast({
        title: 'Erro',
        description: 'Dados de configuração incompletos.',
        variant: 'destructive',
      });
      return;
    }

    console.log('[ONBOARDING] Iniciando criação de workspace:', {
      userId: user.id,
      email: user.email,
      hasSession: !!session,
      sessionExpiry: session?.expires_at,
      accessTokenLength: session?.access_token?.length,
      workspaceSlug: step2Data.workspaceSlug,
    });

    setIsCompleting(true);
    setCurrentStep(4); // Show loading screen

    const onboardingData = {
      ...step1Data,
      ...step2Data,
      pipelineType
    };

    try {
      console.log('[ONBOARDING] Chamando edge function com payload:', {
        companyName: onboardingData.companyName,
        industry: onboardingData.industry,
        teamSize: onboardingData.teamSize,
        workspaceName: onboardingData.workspaceName,
        workspaceSlug: onboardingData.workspaceSlug,
        pipelineType: onboardingData.pipelineType,
        authHeaderPresent: !!session?.access_token,
      });

      const { data, error } = await supabase.functions.invoke('onboarding-complete', {
        body: onboardingData,
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });

      console.log('[ONBOARDING] Resposta da função:', { 
        data, 
        error,
        hasData: !!data,
        hasError: !!error,
      });

      if (error) {
        console.error('[ONBOARDING] Edge function error:', error);
        throw new Error(error.message || 'Erro ao criar workspace');
      }

      if (data?.error) {
        console.error('[ONBOARDING] Data error:', data.error);
        throw new Error(data.error);
      }

      console.log('[ONBOARDING] Workspace criado com sucesso!');
      
      toast({
        title: 'Workspace criado! 🎉',
        description: data.message || 'Seu CRM está pronto para usar.',
      });

      // Força uma confirmação local do status no banco
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: statusData } = await supabase
            .from('onboarding_status')
            .select('completed')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          console.log('[ONBOARDING] Status confirmado no banco:', statusData);
        }
      } catch (confirmError) {
        console.warn('[ONBOARDING] Erro ao confirmar status (não crítico):', confirmError);
      }

      // OnboardingSuccess component will call handleComplete after animation
    } catch (error: any) {
      console.error('[ONBOARDING] Erro completo:', {
        message: error.message,
        name: error.name,
        status: error.status,
        stack: error.stack,
      });

      setIsCompleting(false);
      
      let errorMessage = 'Tente novamente em alguns instantes.';
      let errorTitle = 'Erro ao criar workspace';
      
      // Handle authentication errors
      const isAuthError = error.message?.toLowerCase().includes('não autenticado') || 
                         error.message?.toLowerCase().includes('não está autenticado') ||
                         error.status === 401;

      if (isAuthError) {
        console.log('[ONBOARDING] Erro de autenticação detectado, redirecionando para login');
        errorTitle = 'Sessão expirada';
        errorMessage = 'Sua sessão expirou. Faça login novamente.';
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }
      
      // Handle duplicate slug
      if (error.message.includes('já está em uso') || error.message.includes('duplicad')) {
        console.log('[ONBOARDING] Erro de slug duplicado, voltando para Step 2');
        errorMessage = error.message;
        setCurrentStep(2);
      } else {
        console.log('[ONBOARDING] Outro erro, voltando para Step 3');
        setCurrentStep(3);
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleComplete = () => {
    console.log('[ONBOARDING] Chamando handleComplete, redirecionando para /app/dashboard');
    navigate('/app/dashboard');
  };

  return (
    <OnboardingLayout currentStep={Math.min(currentStep, 3)} totalSteps={3}>
      {currentStep === 1 && (
        <Step1Company onNext={handleStep1Next} />
      )}

      {currentStep === 2 && step1Data && (
        <Step2Workspace
          companyName={step1Data.companyName}
          onNext={handleStep2Next}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <Step3Pipeline
          onNext={handleStep3Next}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && (
        <OnboardingSuccess onComplete={handleComplete} />
      )}
    </OnboardingLayout>
  );
}
