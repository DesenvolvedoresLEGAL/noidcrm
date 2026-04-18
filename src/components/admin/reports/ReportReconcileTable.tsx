/**
 * Sprint 2.9 — Tabela dos checks de reconciliação.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getReconcileLabel } from '@/lib/reports/reconcileLabels';
import type { ReconcileCheck } from '@/hooks/useReportReconcileV2';

function formatValue(v: number, type: ReconcileCheck['type']) {
  if (type === 'monetary') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (type === 'pct') return `${v.toFixed(2)}%`;
  return v.toLocaleString('pt-BR');
}

export function ReportReconcileTable({ checks }: { checks: ReconcileCheck[] }) {
  if (!checks?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum check disponível.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Check</TableHead>
            <TableHead>Esperado</TableHead>
            <TableHead>Atual</TableHead>
            <TableHead>Delta</TableHead>
            <TableHead>Severidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((c) => {
            const sev = getReconcileLabel(c.isConsistent ? 'info' : c.severity);
            return (
              <TableRow key={c.key}>
                <TableCell>
                  <div className="font-medium text-sm">{c.description}</div>
                  <div className="text-xs text-muted-foreground">{c.key}</div>
                </TableCell>
                <TableCell className="text-sm">{formatValue(c.expected, c.type)}</TableCell>
                <TableCell className="text-sm">{formatValue(c.actual, c.type)}</TableCell>
                <TableCell className="text-sm">{formatValue(c.delta, c.type)}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${sev.badgeClass}`}>{sev.label}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
