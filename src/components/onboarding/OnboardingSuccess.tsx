import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOADING_STEPS = [
  'Criando sua organização...',
  'Configurando pipeline de vendas...',
  'Preparando dashboard...',
  'Tudo pronto! 🎉'
];

interface OnboardingSuccessProps {
  onComplete: () => void;
}

export function OnboardingSuccess({ onComplete }: OnboardingSuccessProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        setTimeout(onComplete, 1000);
        return prev;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <Card className="border-2 shadow-xl animate-fade-in">
      <CardContent className="pt-16 pb-12 px-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            {currentStep < LOADING_STEPS.length - 1 ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <Check className="w-10 h-10 text-green-500 animate-scale-in" />
            )}
          </div>

          <div className="space-y-4 mb-8">
            {LOADING_STEPS.map((step, idx) => (
              <div
                key={idx}
                className={cn(
                  'text-lg transition-all duration-300',
                  idx === currentStep ? 'text-foreground font-semibold scale-105' : 'text-muted-foreground opacity-50'
                )}
              >
                {idx < currentStep && '✓ '}
                {step}
              </div>
            ))}
          </div>

          {currentStep === LOADING_STEPS.length - 1 && (
            <p className="text-muted-foreground animate-fade-in">
              Redirecionando para seu dashboard...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
