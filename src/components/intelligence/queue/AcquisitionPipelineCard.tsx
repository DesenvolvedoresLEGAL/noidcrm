import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQualifiedQueueKpis } from '@/hooks/intelligence/useQualifiedQueueKpis';

/**
 * Pipeline executivo de aquisição.
 * Funil: Capturados → Qualificados → Prontos SDR → Importados.
 * Read-only. Não substitui métricas oficiais de receita/forecast.
 */
export function AcquisitionPipelineCard() {
  const { data } = useQualifiedQueueKpis();

  const steps = [
    { label: 'Capturados', value: data?.captured ?? 0 },
    { label: 'Qualificados', value: data?.qualified ?? 0 },
    { label: 'Prontos SDR', value: data?.ready_for_sdr ?? 0 },
    { label: 'Importados (CRM)', value: data?.imported ?? 0 },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline de Aquisição</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-36 text-xs text-muted-foreground">{s.label}</div>
              <div className="flex-1 h-6 rounded bg-muted relative overflow-hidden">
                <div
                  className="h-full bg-primary/80"
                  style={{ width: `${(s.value / max) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm font-semibold">{s.value}</div>
            </div>
          ))}
          <div className="text-xs text-muted-foreground mt-2">
            Taxa de aproveitamento (importados/capturados):{' '}
            <span className="font-semibold text-foreground">{data?.conversion_rate ?? 0}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
