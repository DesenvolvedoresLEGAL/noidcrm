import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonRow {
  feature: string;
  neural: boolean;
  autonomous: boolean;
}

const comparisonData: ComparisonRow[] = [
  { feature: "IA assistiva", neural: true, autonomous: true },
  { feature: "IA executa tarefas", neural: false, autonomous: true },
  { feature: "Agentes de IA", neural: false, autonomous: true },
  { feature: "Automação total", neural: false, autonomous: true },
  { feature: "Consumo de VOLTS", neural: false, autonomous: true },
];

interface PricingComparisonTableProps {
  isInView?: boolean;
  delay?: number;
}

export function PricingComparisonTable({
  isInView = true,
  delay = 0,
}: PricingComparisonTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="w-full max-w-2xl mx-auto"
    >
      <h3 className="text-xl font-semibold text-center mb-6">
        Comparação rápida
      </h3>
      <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 border-b border-border/50">
          <div className="text-sm font-medium text-muted-foreground">
            Recurso
          </div>
          <div className="text-sm font-medium text-center">🧠 Neural</div>
          <div className="text-sm font-medium text-center text-primary">
            🤖 Autonomous
          </div>
        </div>

        {/* Rows */}
        {comparisonData.map((row, index) => (
          <div
            key={row.feature}
            className={cn(
              "grid grid-cols-3 gap-4 p-4",
              index !== comparisonData.length - 1 && "border-b border-border/30"
            )}
          >
            <div className="text-sm text-foreground/80">{row.feature}</div>
            <div className="flex justify-center">
              {row.neural ? (
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex justify-center">
              {row.autonomous ? (
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Price Row */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 border-t border-border/50">
          <div className="text-sm font-medium text-foreground">Preço</div>
          <div className="text-center">
            <span className="font-semibold">R$ 199,90</span>
          </div>
          <div className="text-center">
            <span className="font-semibold text-primary">R$ 299,90</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
