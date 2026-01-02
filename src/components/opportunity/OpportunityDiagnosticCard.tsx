import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle,
  Calendar,
} from "lucide-react";
import { DiagnosticRadarChart } from "@/components/diagnostic/DiagnosticRadarChart";
import { diagnosticQuestions } from "@/data/diagnosticQuestions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DiagnosticResult } from "@/hooks/useOpportunityDiagnostic";

interface OpportunityDiagnosticCardProps {
  diagnostic: DiagnosticResult;
}

const classificationConfig = {
  critical: {
    label: "Crítico",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    icon: AlertTriangle,
  },
  at_risk: {
    label: "Em Risco",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: AlertCircle,
  },
  developing: {
    label: "Em Desenvolvimento",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: TrendingUp,
  },
  healthy: {
    label: "Operação Saudável",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: CheckCircle,
  },
};

const areaLabels: Record<string, string> = {
  pipeline: "Pipeline",
  followup: "Follow-up",
  prioritization: "Priorização",
  crm: "CRM",
  forecast: "Previsibilidade",
  lossAnalysis: "Análise de Perdas",
  automation: "Automação",
};

export function OpportunityDiagnosticCard({ diagnostic }: OpportunityDiagnosticCardProps) {
  const config = classificationConfig[diagnostic.classification as keyof typeof classificationConfig] 
    || classificationConfig.developing;
  const ClassificationIcon = config.icon;

  // Build scores object for radar chart
  const scores = {
    pipeline: diagnostic.area_scores?.pipeline || 0,
    followup: diagnostic.area_scores?.followup || 0,
    prioritization: diagnostic.area_scores?.prioritization || 0,
    crm: diagnostic.area_scores?.crm || 0,
    forecast: diagnostic.area_scores?.forecast || 0,
    lossAnalysis: diagnostic.area_scores?.lossAnalysis || 0,
    automation: diagnostic.area_scores?.automation || 0,
  };

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <Card className={`${config.bgColor} ${config.borderColor} border`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            {/* Score Circle */}
            <motion.div 
              className="relative w-24 h-24 flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={config.color}
                  strokeDasharray={`${(diagnostic.total_score / 100) * 283} 283`}
                  initial={{ strokeDasharray: "0 283" }}
                  animate={{ strokeDasharray: `${(diagnostic.total_score / 100) * 283} 283` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${config.color}`}>
                  {diagnostic.total_score}
                </span>
              </div>
            </motion.div>

            {/* Classification Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <ClassificationIcon className={`w-5 h-5 ${config.color}`} />
                <Badge variant="outline" className={`${config.color} ${config.borderColor}`}>
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Score de maturidade da operação de vendas baseado em 7 dimensões críticas.
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Realizado em {format(new Date(diagnostic.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Análise por Dimensão</CardTitle>
        </CardHeader>
        <CardContent>
          <DiagnosticRadarChart scores={scores} />
        </CardContent>
      </Card>

      {/* Detailed Answers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Respostas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnostic.answers?.map((answer, index) => {
              const question = diagnosticQuestions.find(q => q.id === answer.questionId);
              if (!question) return null;

              const selectedOption = question.options[answer.selectedOption];
              const maxPoints = Math.max(...question.options.map(o => o.points));
              const isGoodAnswer = answer.points >= maxPoints * 0.7;
              const isBadAnswer = answer.points <= maxPoints * 0.3;

              return (
                <motion.div
                  key={answer.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {areaLabels[answer.areaKey] || answer.areaKey}
                        </Badge>
                        <span className={`text-xs font-medium ${
                          isGoodAnswer ? "text-green-500" : 
                          isBadAnswer ? "text-destructive" : 
                          "text-yellow-500"
                        }`}>
                          {answer.points}/{maxPoints} pts
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{question.question}</p>
                      <p className={`text-sm ${
                        isGoodAnswer ? "text-green-600 dark:text-green-400" : 
                        isBadAnswer ? "text-destructive" : 
                        "text-muted-foreground"
                      }`}>
                        → {selectedOption?.label}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
