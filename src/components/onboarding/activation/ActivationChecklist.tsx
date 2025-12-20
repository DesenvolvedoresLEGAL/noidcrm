import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Rocket,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useActivationChecklist, ChecklistItem } from '@/hooks/useActivationChecklist';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

export function ActivationChecklist() {
  const navigate = useNavigate();
  const {
    items,
    progress,
    loading,
    isVisible,
    isMinimized,
    nextItem,
    setIsMinimized,
    markItemComplete,
    dismissChecklist,
  } = useActivationChecklist();

  const [showAll, setShowAll] = useState(false);

  if (loading || !isVisible) return null;

  const handleItemClick = async (item: ChecklistItem) => {
    if (item.route) {
      navigate(item.route);
    }
    
    // Mark visit-based items as complete
    if (item.key === 'visit_forecast') {
      await markItemComplete(item.key);
    }
  };

  const handleComplete = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    dismissChecklist();
  };

  // Show minimized version
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full h-14 w-14 shadow-lg"
          size="icon"
        >
          <div className="relative">
            <Rocket className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 bg-primary-foreground text-primary text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {progress}%
            </span>
          </div>
        </Button>
      </motion.div>
    );
  }

  const visibleItems = showAll ? items : items.slice(0, 5);
  const completedCount = items.filter((i) => i.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Ative seu CRM</h3>
                <p className="text-xs text-muted-foreground">
                  {completedCount} de {items.length} concluídos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMinimized(true)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={dismissChecklist}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Next Step Highlight */}
          {nextItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary">Próximo passo</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{nextItem.label}</p>
                  <p className="text-xs text-muted-foreground">{nextItem.description}</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleItemClick(nextItem)}
                  className="shrink-0"
                >
                  Fazer agora
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Checklist Items */}
          <div className="space-y-1">
            <AnimatePresence>
              {visibleItems.map((item, index) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                    item.completed 
                      ? "opacity-60" 
                      : "hover:bg-muted/50",
                    nextItem?.key === item.key && "bg-primary/5"
                  )}
                  onClick={() => !item.completed && handleItemClick(item)}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm",
                    item.completed && "line-through text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Show more/less */}
          {items.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Ver todos ({items.length - 5} restantes)
                </>
              )}
            </Button>
          )}

          {/* Complete celebration */}
          {progress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center"
            >
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-medium text-green-600">Parabéns!</p>
              <p className="text-sm text-muted-foreground mb-3">
                Você completou toda a configuração do seu CRM!
              </p>
              <Button onClick={handleComplete} variant="outline" size="sm">
                Fechar checklist
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
