import { ReactNode } from 'react';
import { ProgressBar } from './ProgressBar';
import { Zap } from 'lucide-react';

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
}

export function OnboardingLayout({ children, currentStep, totalSteps }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">NOID CRM</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="w-4 h-4" />
          <span>Setup em 2 minutos</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
