import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DiagnosticProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function DiagnosticProgress({ currentStep, totalSteps }: DiagnosticProgressProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          Pergunta {currentStep + 1} de {totalSteps}
        </span>
        <span className="text-primary font-medium">
          {Math.round(((currentStep + 1) / totalSteps) * 100)}%
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={cn(
              "h-1.5 flex-1 rounded-full origin-left transition-colors duration-300",
              index <= currentStep ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
