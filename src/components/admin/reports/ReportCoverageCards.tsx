/**
 * Sprint 2.9 — Cards de cobertura por categoria (monetary/stage/owner/qual/loss_complete/loss_any).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getConfidenceLabel } from '@/lib/reports/confidenceLabels';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  coverage: {
    monetary: number;
    stage_history: number;
    owner_history: number;
    qualification_history: number;
    loss_complete: number;
    loss_any: number;
  } | null;
  isLoading?: boolean;
}

const CARDS: Array<{ key: keyof NonNullable<Props['coverage']>; label: string; description: string }> = [
  { key: 'monetary',              label: 'Monetária',              description: 'Oportunidades com valor de proposta consolidado' },
  { key: 'stage_history',         label: 'Histórico de etapa',     description: 'Trilha real de movimentação de etapas' },
  { key: 'owner_history',         label: 'Histórico de dono',      description: 'Trilha de transferência de responsável' },
  { key: 'qualification_history', label: 'Histórico de qualificação', description: 'Marcação de qualified_by_user_id' },
  { key: 'loss_complete',         label: 'Perdas completas',       description: 'Perdas com motivo do cliente E vendedor' },
  { key: 'loss_any',              label: 'Perdas com motivo',      description: 'Perdas com pelo menos um motivo registrado' },
];

export function ReportCoverageCards({ coverage, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Card key={c.key}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {CARDS.map((c) => {
        const value = Number(coverage?.[c.key] ?? 0);
        const lbl = getConfidenceLabel(value);
        return (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xl font-semibold">{value.toFixed(1)}%</span>
                <span className={`text-xs px-2 py-1 rounded-md font-medium ${lbl.badgeClass}`}>{lbl.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{c.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
