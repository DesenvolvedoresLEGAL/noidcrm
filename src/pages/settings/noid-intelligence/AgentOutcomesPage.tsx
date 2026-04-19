import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAIAgent } from '@/hooks/useAIAgents';
import { useAgentOutcomes } from '@/hooks/useAgentOutcomes';
import OutcomeKPIs from '@/components/noid-intelligence/outcomes/OutcomeKPIs';
import RunsTable from '@/components/noid-intelligence/outcomes/RunsTable';

const RANGES = [
  { key: 7, label: '7d' },
  { key: 14, label: '14d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
];

export default function AgentOutcomesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState(30);
  const { data: agent } = useAIAgent(id);
  const { data, isLoading, refetch, isFetching } = useAgentOutcomes(id, range);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/app/settings/noid-intelligence/agents/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold">{agent?.name || 'Agente'} — Outcomes</h1>
              <p className="text-sm text-muted-foreground">Resultados reais com atribuição de 7 dias</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v))}>
            <TabsList>
              {RANGES.map(r => (
                <TabsTrigger key={r.key} value={String(r.key)}>{r.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !data ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados</CardContent></Card>
      ) : (
        <>
          <OutcomeKPIs kpis={data.kpis} />
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold">Execuções recentes</h2>
              <RunsTable rows={data.runs} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
