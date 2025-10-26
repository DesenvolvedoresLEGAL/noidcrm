import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Step1Company, Step1Data } from '@/components/onboarding/Step1Company';
import { Step2Workspace, Step2Data } from '@/components/onboarding/Step2Workspace';
import { Step3Pipeline } from '@/components/onboarding/Step3Pipeline';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';
import { completeOnboarding, OnboardingData } from '@/services/onboarding';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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

    const onboardingData: OnboardingData = {
      ...step1Data,
      ...step2Data,
      pipelineType
    };

    try {
      await completeOnboarding(user.id, onboardingData);
      
      toast({
        title: 'Workspace criado! 🎉',
        description: 'Seu CRM está pronto para usar.',
      });

      // OnboardingSuccess component will call this after animation
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Erro ao criar workspace',
        description: error.message,
        variant: 'destructive',
      });
      setCurrentStep(3);
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
