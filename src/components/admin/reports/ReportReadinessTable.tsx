/**
 * Sprint 2.9 — Tabela 13 abas × status + score + razões para desligamento do legacy.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getReadinessLabel } from '@/lib/reports/readinessLabels';
import type { ReadinessRow } from '@/hooks/useReportHealthV2';

const TAB_LABELS: Record<string, string> = {
  general: 'Geral',
  losses: 'Perdas',
  forecast: 'Forecast',
  closer: 'Closer',
  team: 'Equipe',
  origins: 'Origens',
  processed: 'Processadas',
  sdr: 'SDR',
  handoff: 'Handoff',
  stage_balance: 'Balanceamento',
  stage_conversion: 'Conversão',
  stages: 'Estágios',
  accumulated: 'Acumuladas',
};

export function ReportReadinessTable({ rows }: { rows: ReadinessRow[] }) {
  if (!rows?.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma aba disponível.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aba</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Reconcile</TableHead>
            <TableHead className="w-[35%]">Sinais</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const lbl = getReadinessLabel(r.readiness_status);
            const reasons = r.reasons ?? {};
            const monCov = Number((reasons as Record<string, number>).monetary_coverage_pct ?? 0);
            const stageCov = Number((reasons as Record<string, number>).stage_history_coverage_pct ?? 0);
            const qualCov = Number((reasons as Record<string, number>).qualification_history_coverage_pct ?? 0);
            return (
              <TableRow key={r.report_key}>
                <TableCell>
                  <div className="font-medium">{TAB_LABELS[r.report_key] ?? r.report_key}</div>
                  <div className="text-xs text-muted-foreground">{r.report_key}</div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${lbl.badgeClass}`}>{lbl.label}</span>
                </TableCell>
                <TableCell className="text-sm font-medium">{Number(r.readiness_score ?? 0).toFixed(0)}</TableCell>
                <TableCell className="text-xs">
                  {r.last_check_at ? (r.reconcile_consistent ? 'Consistente' : `${r.reconcile_severity}`) : 'Sem dados'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  Monetário: {monCov.toFixed(0)}% · Etapa: {stageCov.toFixed(0)}% · Qual: {qualCov.toFixed(0)}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
