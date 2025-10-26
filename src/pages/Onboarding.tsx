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

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const { user, session } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  if (!user && !session) {
    navigate('/login');
    return null;
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
    if (!user || !step1Data || !step2Data) return;

    setIsCompleting(true);
    setCurrentStep(4); // Show loading screen

    const onboardingData = {
      ...step1Data,
      ...step2Data,
      pipelineType
    };

    try {
      const { data, error } = await supabase.functions.invoke('onboarding-complete', {
        body: onboardingData,
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao criar workspace');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('Onboarding completed:', data);
      
      toast({
        title: 'Workspace criado! 🎉',
        description: data.message || 'Seu CRM está pronto para usar.',
      });

      // OnboardingSuccess component will call this after animation
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      
      let errorMessage = 'Tente novamente em alguns instantes.';
      let errorTitle = 'Erro ao criar workspace';
      
      // Handle authentication errors
      if (error.message?.includes('não autenticado') || error.message?.includes('Usuário não autenticado')) {
        errorTitle = 'Sessão expirada';
        errorMessage = 'Sua sessão expirou. Faça login novamente.';
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
        setIsCompleting(false);
        navigate('/login');
        return;
      }
      
      // Handle duplicate slug
      if (error.message.includes('já está em uso')) {
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
      
      setIsCompleting(false);
    }
  };

  const handleComplete = () => {
    navigate('/');
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

      {currentStep === 4 && isCompleting && (
        <OnboardingSuccess onComplete={handleComplete} />
      )}
    </OnboardingLayout>
  );
}
