import { Loader2, Check, Globe, FileSearch, Users, BarChart3, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'discovering', label: 'Descobrindo páginas', icon: Globe },
  { id: 'classifying', label: 'Classificando páginas', icon: FileSearch },
  { id: 'extracting', label: 'Extraindo expositores', icon: Users },
  { id: 'scoring', label: 'Pontuando prospects', icon: BarChart3 },
  { id: 'finalizing', label: 'Finalizando execução', icon: Flag },
];

interface EventProgressStepperProps {
  elapsedSeconds: number;
}

export function EventProgressStepper({ elapsedSeconds }: EventProgressStepperProps) {
  // Simulate progress based on elapsed time
  const currentStepIndex = elapsedSeconds < 5 ? 0 : elapsedSeconds < 15 ? 1 : elapsedSeconds < 30 ? 2 : elapsedSeconds < 45 ? 3 : 4;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h3 className="text-sm font-semibold">Executando Playbook de Evento...</h3>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStepIndex;
          const isDone = i < currentStepIndex;
          return (
            <div key={step.id} className={cn('flex items-center gap-3 text-sm transition-opacity', {
              'opacity-100': isActive || isDone,
              'opacity-40': !isActive && !isDone,
            })}>
              {isDone ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn({ 'font-medium text-foreground': isActive, 'text-muted-foreground': !isActive })}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
