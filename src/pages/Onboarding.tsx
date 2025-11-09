import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Step1Company, Step1Data } from '@/components/onboarding/Step1Company';
import { Step2Workspace, Step2Data } from '@/components/onboarding/Step2Workspace';
import { Step3Pipeline } from '@/components/onboarding/Step3Pipeline';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    user,
    isOwner,
    isOrgAdmin,
    hasAdminRole,
    loading: userLoading,
  } = useCurrentUser();
  const { onboardingCompleted, loading: onboardingLoading } = useOnboardingStatus(user?.id);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!userLoading && user && onboardingCompleted) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [userLoading, user, onboardingCompleted, navigate]);

  useEffect(() => {
    if (!userLoading && !onboardingLoading && user) {
      const canOnboard = isOwner || isOrgAdmin || hasAdminRole;
      if (!canOnboard) {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [userLoading, onboardingLoading, user, isOwner, isOrgAdmin, hasAdminRole, navigate]);

  if (userLoading || onboardingLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Preparando seu workspace...</p>
        </div>
      </div>
    );
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
      toast({
        title: 'Erro',
        description: 'Dados de configuração incompletos.',
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep(4); // Show loading screen

    const onboardingData = {
      ...step1Data,
      ...step2Data,
      pipelineType
    };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('onboarding-complete', {
        body: onboardingData,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar workspace');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Workspace criado! 🎉',
        description: data.message || 'Seu CRM está pronto para usar.',
      });

      // OnboardingSuccess component will call handleComplete after animation
    } catch (error: any) {
      let errorMessage = 'Tente novamente em alguns instantes.';
      let errorTitle = 'Erro ao criar workspace';

      // Handle authentication errors
      const isAuthError = error.message?.toLowerCase().includes('não autenticado') ||
                         error.message?.toLowerCase().includes('não está autenticado') ||
                         error.status === 401;

      if (isAuthError) {
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
        errorMessage = error.message;
        setCurrentStep(2);
      } else {
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
    navigate('/app/dashboard', { replace: true });
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
