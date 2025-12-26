import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreExplainabilityCard, ScoreExplainability } from './ScoreExplainabilityCard';
import { Sparkles } from 'lucide-react';

interface FullExplainabilityPanelProps {
  scores: {
    cs_final: number | null;
    bs_final: number | null;
    ds_final: number | null;
    ras_final: number | null;
    cs_explainability?: ScoreExplainability | null;
    bs_explainability?: ScoreExplainability | null;
    ds_explainability?: ScoreExplainability | null;
    ras_explainability?: ScoreExplainability | null;
  } | null;
  previousScores?: {
    cs_final: number | null;
    bs_final: number | null;
    ds_final: number | null;
    ras_final: number | null;
  } | null;
}

export function FullExplainabilityPanel({ scores, previousScores }: FullExplainabilityPanelProps) {
  if (!scores) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Sem dados de performance disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Explicabilidade Completa dos Scores</h2>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <ScoreExplainabilityCard
          scoreType="CS"
          scoreValue={scores.cs_final}
          explainability={scores.cs_explainability || null}
          previousValue={previousScores?.cs_final}
        />
        <ScoreExplainabilityCard
          scoreType="BS"
          scoreValue={scores.bs_final}
          explainability={scores.bs_explainability || null}
          previousValue={previousScores?.bs_final}
        />
        <ScoreExplainabilityCard
          scoreType="DS"
          scoreValue={scores.ds_final}
          explainability={scores.ds_explainability || null}
          previousValue={previousScores?.ds_final}
        />
        <ScoreExplainabilityCard
          scoreType="RAS"
          scoreValue={scores.ras_final}
          explainability={scores.ras_explainability || null}
          previousValue={previousScores?.ras_final}
        />
      </div>
    </div>
  );
}
