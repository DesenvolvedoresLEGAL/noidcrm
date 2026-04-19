import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OutcomeRunRow } from '@/hooks/useAgentOutcomes';
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_LABELS } from '@/types/ai-agents';

interface Props { rows: OutcomeRunRow[] }

const fmtMoney = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function RunsTable({ rows }: Props) {
  const navigate = useNavigate();

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma execução no período.</p>;
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Quando</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Aberto</TableHead>
            <TableHead className="text-center">Resp.</TableHead>
            <TableHead className="text-center">Avançou</TableHead>
            <TableHead className="text-center">Won</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const status = (r.execution_status as keyof typeof EXECUTION_STATUS_LABELS) || 'queued';
            return (
              <TableRow key={r.run_id}>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="max-w-[260px]">
                  <div className="truncate font-medium text-sm">{r.opportunity_title || r.scenario_label || '—'}</div>
                  {r.email_subject && (
                    <div className="truncate text-xs text-muted-foreground">{r.email_subject}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${EXECUTION_STATUS_COLORS[status]}`}>
                    {EXECUTION_STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {r.opened_at ? <Check className="h-4 w-4 text-green-600 inline" /> : <X className="h-4 w-4 text-muted-foreground/40 inline" />}
                </TableCell>
                <TableCell className="text-center">
                  {r.replied_at ? <Check className="h-4 w-4 text-green-600 inline" /> : <X className="h-4 w-4 text-muted-foreground/40 inline" />}
                </TableCell>
                <TableCell className="text-center">
                  {r.deal_progressed_at ? <Check className="h-4 w-4 text-emerald-600 inline" /> : <X className="h-4 w-4 text-muted-foreground/40 inline" />}
                </TableCell>
                <TableCell className="text-center">
                  {r.deal_won_at ? <Check className="h-4 w-4 text-green-700 inline" /> : <X className="h-4 w-4 text-muted-foreground/40 inline" />}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{fmtMoney(r.opportunity_amount)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => navigate(`/app/settings/noid-intelligence/runs/${r.run_id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
