import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DiagnosticQuestion as QuestionType } from "@/types/diagnostic";

interface DiagnosticQuestionProps {
  question: QuestionType;
  selectedOption: number | null;
  onSelect: (optionIndex: number) => void;
}

export function DiagnosticQuestion({ 
  question, 
  selectedOption, 
  onSelect 
}: DiagnosticQuestionProps) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          {question.area}
        </span>
        <h3 className="text-xl md:text-2xl font-semibold leading-tight">
          {question.question}
        </h3>
      </div>

      <div className="space-y-3">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => onSelect(index)}
            className={cn(
              "w-full p-4 text-left rounded-xl border-2 transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              selectedOption === index
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200",
                  "flex items-center justify-center",
                  selectedOption === index
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                )}
              >
                {selectedOption === index && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full bg-primary-foreground"
                  />
                )}
              </div>
              <span className={cn(
                "text-sm md:text-base",
                selectedOption === index ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {option.label}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
