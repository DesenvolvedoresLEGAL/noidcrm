import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, DollarSign, Target, AlertTriangle, Award } from 'lucide-react';
import { getPipelineHealthSummary, PipelineHealthSummary } from '@/services/crm/pipeline-health';
import { listPipelines } from '@/services/crm/pipelines';
import { Pipeline } from '@/services/crm/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export function PipelineHealthDashboard() {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [healthData, setHealthData] = useState<PipelineHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipelines();
  }, []);

  useEffect(() => {
    if (selectedPipelineId) {
      loadHealthData();
    }
  }, [selectedPipelineId]);

  const loadPipelines = async () => {
    try {
      const data = await listPipelines();
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipelineId(data[0].id);
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar pipelines',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHealthData = async () => {
    if (!selectedPipelineId) return;
    
    setLoading(true);
    try {
      const data = await getPipelineHealthSummary(selectedPipelineId);
      setHealthData(data);
    } catch (error) {
      console.error('Error loading pipeline health:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading || !healthData) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Saúde do Pipeline</h2>
        <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total de Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.total_deals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(healthData.total_value)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Forecast Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {formatCurrency(healthData.weighted_forecast)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Deals Estagnados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {healthData.stale_deals_count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">&gt;7 dias sem atividade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {healthData.win_rate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage-by-Stage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Análise por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthData.stages.map((stage) => (
              <div key={stage.stage_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{stage.stage_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.deal_count} deals • {formatCurrency(stage.total_value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{stage.probability}% prob</Badge>
                    <Badge variant="secondary">{formatCurrency(stage.weighted_value)} ponderado</Badge>
                    {stage.stale_deals > 0 && (
                      <Badge variant="destructive">{stage.stale_deals} estagnados</Badge>
                    )}
                  </div>
                </div>
                <Progress value={(stage.deal_count / healthData.total_deals) * 100} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
