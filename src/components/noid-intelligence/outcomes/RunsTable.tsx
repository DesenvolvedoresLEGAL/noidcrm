import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, Bot, Workflow, Pause, RotateCw, PencilLine } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OutcomeRunRow } from '@/hooks/useAgentOutcomes';
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_LABELS } from '@/types/ai-agents';

interface Props { rows: OutcomeRunRow[] }

const fmtMoney = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtDateTime = (iso: string | null) =>
  iso ? format(new Date(iso), 'dd/MM HH:mm', { locale: ptBR }) : '—';

const SKIP_REASON_LABELS: Record<string, string> = {
  cooldown: 'Cooldown',
  manual_seller_contact: 'Contato manual',
  policy: 'Política',
  contact_no_email: 'Sem e-mail',
};

function OriginBadge({ row }: { row: OutcomeRunRow }) {
  if (row.execution_status === 'skipped') {
    const reasonKey = row.skip_reason || '';
    const label = SKIP_REASON_LABELS[reasonKey] || reasonKey || 'Política';
    return (
      <Badge variant="outline" className="text-xs gap-1 bg-muted/40 text-muted-foreground border-muted">
        <Pause className="h-3 w-3" /> Skip: {label}
      </Badge>
    );
  }
  if (row.forced_to_draft) {
    return (
      <Badge variant="outline" className="text-xs gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
        <Workflow className="h-3 w-3" /> AI: aguardar → Workflow forçou
      </Badge>
    );
  }
  if (row.ai_should_act === true) {
    return (
      <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
        <Bot className="h-3 w-3" /> AI: enviar
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Bot className="h-3 w-3" /> —
    </Badge>
  );
}

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
            <TableHead className="w-[110px]">Criado</TableHead>
            <TableHead className="w-[110px]">Aprovado</TableHead>
            <TableHead className="w-[110px]">Enviado</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Origem</TableHead>
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
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.approved_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.email_sent_at)}</TableCell>
                <TableCell className="max-w-[260px]">
                  <div className="truncate font-medium text-sm">{r.opportunity_title || r.scenario_label || '—'}</div>
                  {r.email_subject && (
                    <div className="truncate text-xs text-muted-foreground">{r.email_subject}</div>
                  )}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {r.send_attempts > 1 && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                        <RotateCw className="h-2.5 w-2.5" /> Reenvio ({r.send_attempts}x)
                      </Badge>
                    )}
                    {r.was_human_edited && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                        <PencilLine className="h-2.5 w-2.5" /> Editado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell><OriginBadge row={r} /></TableCell>
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
