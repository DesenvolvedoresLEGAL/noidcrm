import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingTour, SIDEBAR_TOUR_STEPS } from '@/hooks/useOnboardingTour';
import { cn } from '@/lib/utils';

interface SidebarOnboardingTourProps {
  sidebarOpen: boolean;
}

export function SidebarOnboardingTour({ sidebarOpen }: SidebarOnboardingTourProps) {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    hasCompleted,
    startTour,
    nextStep,
    prevStep,
    skipTour,
  } = useOnboardingTour();

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showStartPrompt, setShowStartPrompt] = useState(false);

  // Show start prompt for new users after a delay
  useEffect(() => {
    if (!hasCompleted && !isActive) {
      const timer = setTimeout(() => {
        setShowStartPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted, isActive]);

  // Calculate position based on target element
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const calculatePosition = () => {
      const targetElement = document.querySelector(`[data-tour="${currentStepData.target}"]`);
      if (!targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 200;
      const offset = 16;

      let top = rect.top;
      let left = rect.right + offset;

      // Adjust based on position preference
      switch (currentStepData.position) {
        case 'top':
          top = rect.top - tooltipHeight - offset;
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
          left = rect.left - tooltipWidth - offset;
          break;
        case 'right':
        default:
          top = rect.top;
          left = rect.right + offset;
          break;
      }

      // Keep within viewport
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

      setPosition({ top, left });

      // Add highlight to target
      targetElement.classList.add('tour-highlight');
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      // Remove highlight from all elements
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    };
  }, [isActive, currentStep, currentStepData]);

  if (!sidebarOpen) return null;

  return (
    <>
      {/* Start Prompt for New Users */}
      <AnimatePresence>
        {showStartPrompt && !isActive && !hasCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 left-4 z-[100] w-80"
          >
            <div className="bg-gradient-to-br from-primary/10 via-background to-background border border-primary/20 rounded-xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Primeira vez aqui?
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Faça um tour rápido pelo menu e descubra todas as funcionalidades.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowStartPrompt(false);
                        startTour();
                      }}
                    >
                      Começar Tour
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowStartPrompt(false);
                        skipTour();
                      }}
                    >
                      Depois
                    </Button>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 -mt-1 -mr-1"
                  onClick={() => setShowStartPrompt(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour Overlay */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[90]"
              onClick={skipTour}
            />

            {/* Tooltip */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 100,
              }}
              className="w-80"
            >
              <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <div className="p-4">
                  {/* Step indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Passo {currentStep + 1} de {totalSteps}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={skipTour}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Content */}
                  <h3 className="font-semibold text-lg mb-2">
                    {currentStepData?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {currentStepData?.description}
                  </p>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className={cn(currentStep === 0 && 'invisible')}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>

                    <div className="flex gap-1">
                      {SIDEBAR_TOUR_STEPS.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full transition-colors',
                            idx === currentStep ? 'bg-primary' : 'bg-muted'
                          )}
                        />
                      ))}
                    </div>

                    <Button size="sm" onClick={nextStep}>
                      {currentStep === totalSteps - 1 ? (
                        'Concluir'
                      ) : (
                        <>
                          Próximo
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CSS for highlight effect */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 95 !important;
          background: hsl(var(--card)) !important;
          border-radius: 8px;
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2);
        }
      `}</style>
    </>
  );
}
