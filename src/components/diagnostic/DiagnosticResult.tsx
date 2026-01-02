import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, TrendingUp, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiagnosticRadarChart } from "./DiagnosticRadarChart";
import { getClassificationInfo } from "@/data/diagnosticQuestions";
import { cn } from "@/lib/utils";
import type { DiagnosticResult as ResultType } from "@/types/diagnostic";

interface DiagnosticResultProps {
  result: ResultType;
  onClose: () => void;
}

const iconMap = {
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  CheckCircle,
};

export function DiagnosticResult({ result, onClose }: DiagnosticResultProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const classificationInfo = getClassificationInfo(result.totalScore);
  const Icon = iconMap[classificationInfo.icon as keyof typeof iconMap];

  // Animate score counting up
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = result.totalScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= result.totalScore) {
        setDisplayScore(result.totalScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [result.totalScore]);

  const handleCTAClick = () => {
    onClose();
    const element = document.querySelector(classificationInfo.ctaLink);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Score Display */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8, delay: 0.2 }}
          className={cn(
            "relative w-40 h-40 mx-auto rounded-full flex items-center justify-center",
            classificationInfo.bgColor,
            "border-4",
            classificationInfo.borderColor
          )}
        >
          <div className="text-center">
            <span className={cn("text-5xl font-bold", classificationInfo.color)}>
              {displayScore}
            </span>
            <span className="text-muted-foreground text-sm block">/100</span>
          </div>
          
          {/* Animated ring */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 160 160"
          >
            <motion.circle
              cx="80"
              cy="80"
              r="76"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
              className={classificationInfo.color}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: result.totalScore / 100 }}
              transition={{ duration: 1.5, delay: 0.3 }}
              style={{
                strokeDasharray: "1",
                strokeDashoffset: "0",
              }}
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full",
            classificationInfo.bgColor
          )}>
            <Icon className={cn("w-5 h-5", classificationInfo.color)} />
            <span className={cn("font-semibold", classificationInfo.color)}>
              {classificationInfo.label}
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold">
            {classificationInfo.title}
          </h3>
        </motion.div>
      </div>

      {/* Radar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-card/50 rounded-2xl p-4 border border-border"
      >
        <h4 className="text-sm font-medium text-muted-foreground mb-2 text-center">
          Análise por Área
        </h4>
        <DiagnosticRadarChart scores={result.scores} />
      </motion.div>

      {/* Message & Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="space-y-4"
      >
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          {classificationInfo.message}
        </p>
        <div className={cn(
          "p-4 rounded-xl border-l-4",
          classificationInfo.bgColor,
          classificationInfo.borderColor
        )}>
          <p className="text-sm font-medium">
            💡 {classificationInfo.recommendation}
          </p>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="space-y-3"
      >
        <Button
          size="lg"
          onClick={handleCTAClick}
          className="w-full text-base py-6 glow-primary"
        >
          {classificationInfo.cta}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-full text-muted-foreground"
        >
          Fechar diagnóstico
        </Button>
      </motion.div>
    </motion.div>
  );
}
