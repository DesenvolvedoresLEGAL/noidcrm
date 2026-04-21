import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Brain, 
  Lightbulb, 
  Video, 
  Trophy,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvaluationStep {
  id: number;
  icon: React.ElementType;
  label: string;
  activeLabel: string;
}

const STEPS: EvaluationStep[] = [
  { id: 1, icon: CheckCircle, label: 'Finalizando sessão', activeLabel: 'Finalizando sessão...' },
  { id: 2, icon: Brain, label: 'Analisando conversa', activeLabel: 'IA analisando sua performance...' },
  { id: 3, icon: Lightbulb, label: 'Gerando insights', activeLabel: 'Gerando insights personalizados...' },
  { id: 4, icon: Video, label: 'Selecionando vídeos', activeLabel: 'Selecionando vídeos recomendados...' },
  { id: 5, icon: Trophy, label: 'Calculando conquistas', activeLabel: 'Processando XP e badges...' }
];

const MOTIVATIONAL_MESSAGES = [
  "Cada treino te deixa mais perto da meta...",
  "Grandes vendedores nunca param de aprender...",
  "Sua dedicação é o diferencial competitivo...",
  "A IA está identificando seus pontos fortes...",
  "Preparando recomendações personalizadas...",
  "Vendedor que treina, vende mais!",
  "Excelência é um hábito, não um ato isolado...",
  "Você está construindo sua melhor versão...",
  "Top performers dedicam tempo para treinar...",
  "Seu compromisso inspira outros...",
  "Quem evolui, lidera...",
  "A prática leva à perfeição...",
  "Cada objeção vencida é uma venda mais perto...",
  "Treino é investimento, não gasto de tempo...",
  "Os melhores vendedores são eternos aprendizes..."
];

interface EvaluationLoadingOverlayProps {
  currentStep: number;
  isVisible: boolean;
  onSkip?: () => void;
  skipAfterMs?: number;
}

export function EvaluationLoadingOverlay({ currentStep, isVisible, onSkip, skipAfterMs = 30000 }: EvaluationLoadingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !onSkip) { setShowSkip(false); return; }
    const t = setTimeout(() => setShowSkip(true), skipAfterMs);
    return () => clearTimeout(t);
  }, [isVisible, onSkip, skipAfterMs]);

  const progressPct = Math.min(100, (currentStep / STEPS.length) * 100);

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden py-6 px-4 min-h-[450px]">
    <div className="flex flex-col items-center justify-center">
      {/* Animated Logo/Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative mb-8"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-10 w-10 text-primary-foreground" />
          </motion.div>
        </div>
        
        {/* Pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Steps Indicator */}
      <div className="w-full max-w-sm space-y-3 mb-8">
        {STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isComplete = step.id < currentStep;
          const isPending = step.id > currentStep;
          const StepIcon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: step.id * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                isActive && "bg-primary/10 border border-primary/20",
                isComplete && "opacity-60",
                isPending && "opacity-40"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                isComplete && "bg-green-500/20 text-green-500",
                isActive && "bg-primary/20 text-primary",
                isPending && "bg-muted text-muted-foreground"
              )}>
                {isComplete ? (
                  <CheckCircle className="h-5 w-5" />
                ) : isActive ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <StepIcon className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
              </div>
              <span className={cn(
                "text-sm font-medium",
                isActive && "text-foreground",
                isComplete && "text-muted-foreground line-through",
                isPending && "text-muted-foreground"
              )}>
                {isActive ? step.activeLabel : step.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-sm mb-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {Math.round(progressPct)}% concluído
        </p>
      </div>

      {/* Motivational Message */}
      <AnimatePresence mode="wait">
        <motion.div
          key={messageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <p className="text-muted-foreground italic flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-primary/60" />
            {MOTIVATIONAL_MESSAGES[messageIndex]}
            <Sparkles className="h-4 w-4 text-primary/60" />
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Floating sparkles decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-primary/20"
            initial={{ 
              x: Math.random() * 100 + '%', 
              y: '100%',
              opacity: 0 
            }}
            animate={{ 
              y: '-10%',
              opacity: [0, 0.5, 0]
            }}
            transition={{ 
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "linear"
            }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
        ))}
      </div>
    </div>
    </div>
  );
}
