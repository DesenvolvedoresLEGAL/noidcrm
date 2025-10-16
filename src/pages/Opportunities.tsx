import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listOpportunities } from '@/services/crm/opportunities';
import { listPipelines } from '@/services/crm/pipelines';
import { Opportunity, Pipeline } from '@/services/crm/types';
import { Loader2 } from 'lucide-react';

export default function Opportunities() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pipelinesData, oppsData] = await Promise.all([
        listPipelines(),
        listOpportunities(),
      ]);
      setPipelines(pipelinesData);
      setOpportunities(oppsData.data);
    } finally {
      setLoading(false);
    }
  };

  const getOppsByStage = (pipelineId: string, stageId: string) => {
    return opportunities.filter(
      (opp) => opp.pipeline_id === pipelineId && opp.stage_id === stageId
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-foreground">Oportunidades</h1>
          <p className="text-muted-foreground mt-1">
            Kanban de oportunidades por pipeline
          </p>
        </div>

        {pipelines.map((pipeline) => (
          <div key={pipeline.id} className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {pipeline.name}
              <Badge variant="outline">{pipeline.bu}</Badge>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {pipeline.stages.map((stage) => {
                const stageOpps = getOppsByStage(pipeline.id, stage.id);
                const stageValue = stageOpps.reduce(
                  (sum, opp) => sum + (opp.valor_previsto || 0),
                  0
                );

                return (
                  <Card key={stage.id} className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">
                        {stage.name}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {stageOpps.length} oportunidade{stageOpps.length !== 1 ? 's' : ''} •{' '}
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          notation: 'compact',
                        }).format(stageValue)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {stageOpps.map((opp) => (
                        <Card
                          key={opp.id}
                          className="p-3 bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="text-sm font-medium">Opp #{opp.id}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {opp.valor_previsto &&
                              new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(opp.valor_previsto)}
                            {opp.prob && ` • ${(opp.prob * 100).toFixed(0)}%`}
                          </div>
                        </Card>
                      ))}
                      {stageOpps.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma oportunidade
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
