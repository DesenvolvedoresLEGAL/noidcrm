import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AutomationFlowChartProps {
  data: { stage: string; count: number; failures: number }[];
}

const TRIGGER_LABELS: Record<string, string> = {
  'stage_enter': 'Entrada no Estágio',
  'opportunity_created': 'Opp. Criada',
  'opportunity_won': 'Opp. Ganha',
  'opportunity_lost': 'Opp. Perdida',
  'activity_completed': 'Atividade Concluída',
  'proposal_sent': 'Proposta Enviada',
  'proposal_viewed': 'Proposta Visualizada',
  'time_based': 'Agendamento',
  'unknown': 'Outro'
};

export function AutomationFlowChart({ data }: AutomationFlowChartProps) {
  const chartData = data.map(d => ({
    ...d,
    label: TRIGGER_LABELS[d.stage] || d.stage,
    success: d.count - d.failures
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fluxo de Automação por Trigger</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhuma automação configurada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  value,
                  name === 'success' ? 'Sucesso' : 'Falhas'
                ]}
              />
              <Bar dataKey="success" stackId="a" fill="hsl(var(--primary))" name="success" />
              <Bar dataKey="failures" stackId="a" fill="hsl(var(--destructive))" name="failures" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
