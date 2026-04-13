import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calculator, RefreshCw, ArrowRight, Zap } from 'lucide-react';

const REVENUE_SIMULATION_KEY = 'winloss-revenue-simulation';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

interface Props {
  organizationId: string;
}

export function WinLossRevenueTab({ organizationId }: Props) {
  const { toast } = useToast();
  const [simulation, setSimulation] = useState<any>(() => {
    try {
      const stored = localStorage.getItem(REVENUE_SIMULATION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) return parsed.data;
      }
    } catch {}
    return null;
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-revenue-impact', {
        body: { organizationId, period: 'year' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSimulation(data.simulation);
      try { localStorage.setItem(REVENUE_SIMULATION_KEY, JSON.stringify({ data: data.simulation, savedAt: Date.now() })); } catch {}
      toast({ title: 'Simulação concluída' });
    },
    onError: (e) => { toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' }); },
  });

  if (!simulation) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Simulador de Impacto em Receita</h3>
          <p className="text-sm text-muted-foreground mb-4">Calcule o potencial de receita adicional com melhorias no win rate</p>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Gerar Simulação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-emerald-500/20">
          <CardHeader><CardTitle className="text-emerald-500 text-sm">Simulação de Receita</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Win Rate Atual</p>
                <p className="text-2xl font-bold">{simulation.metrics.currentWinRate.toFixed(1)}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <p className="text-xs text-muted-foreground">Win Rate Projetado</p>
                <p className="text-2xl font-bold text-emerald-500">{simulation.metrics.projectedWinRate.toFixed(1)}%</p>
              </div>
            </div>
            <div className="p-4 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Receita Incremental Potencial</p>
              <p className="text-3xl font-bold text-emerald-500">{formatCurrency(simulation.metrics.revenueIncrement)}</p>
              <p className="text-xs text-muted-foreground mt-1">por ano</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Melhorias Sugeridas</CardTitle></CardHeader>
          <CardContent>
            {simulation.improvements?.length > 0 ? (
              <div className="space-y-3">
                {simulation.improvements.map((imp: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{imp.area}</p>
                        <Badge variant={imp.difficulty === 'low' ? 'default' : imp.difficulty === 'medium' ? 'secondary' : 'destructive'} className="text-xs">+{imp.potentialImpact}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{imp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-4 text-sm">Sem melhorias identificadas</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-yellow-500" /> Métricas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total de Deals', value: simulation.metrics.totalDeals },
              { label: 'Receita Atual', value: formatCurrency(simulation.metrics.currentRevenue) },
              { label: 'Receita Perdida', value: formatCurrency(simulation.metrics.lostRevenue), color: 'text-red-500' },
              { label: 'Ticket Médio', value: formatCurrency(simulation.metrics.avgDealValue) },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-lg border text-center">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className={`text-lg font-bold ${m.color || ''}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${mutation.isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
