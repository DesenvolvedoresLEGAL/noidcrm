/**
 * Sprint 2.7 — Painel de warnings derivados de confidence.breakdown.
 * Mostra apenas itens com cobertura abaixo de 80%.
 */
import { AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportConfidence } from '@/types/reportEdgeV2';

interface Props {
  confidence: ReportConfidence | null | undefined;
  threshold?: number;
}

const LABEL_MAP: Record<string, string> = {
  monetary: 'Cobertura monetária',
  history: 'Cobertura histórica de estágio',
  loss: 'Classificação de perdas',
  primary_pipeline: 'Pipeline primário configurado',
  goal: 'Meta de receita configurada',
  forecast_reliability: 'Confiabilidade do forecast',
};

export function ReportWarningsPanel({ confidence, threshold = 80 }: Props) {
  if (!confidence?.breakdown) return null;
  const entries = Object.entries(confidence.breakdown).filter(
    ([, v]) => typeof v === 'number' && (v as number) < threshold,
  );
  if (entries.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-start gap-3 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Atenção: alguns dados estão abaixo do limiar de confiança
          </p>
          <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
            {entries.map(([key, value]) => (
              <li key={key} className="flex items-center gap-1.5">
                <Info className="h-3 w-3 opacity-70" />
                <span>
                  {LABEL_MAP[key] ?? key}: <strong>{Math.round(value as number)}%</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
