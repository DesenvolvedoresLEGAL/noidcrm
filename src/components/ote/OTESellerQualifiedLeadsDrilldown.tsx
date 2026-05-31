import { ExternalLink, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQualifiedOpportunitiesByUser } from '@/hooks/results/useHistoricalQualifiers';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

interface Props {
  userId: string;
  userName?: string | null;
  period: string; // 'YYYY-MM'
  /** Total esperado vindo do resumo (para validar divergência). */
  expectedCount: number;
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const fmtBRL = (v: number | null | undefined) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

export function OTESellerQualifiedLeadsDrilldown({ userId, period, expectedCount }: Props) {
  const { organization } = useCurrentOrganization();
  const [py, pm] = (period || '').split('-').map(Number);
  const start = py && pm ? new Date(Date.UTC(py, pm - 1, 1)).toISOString() : undefined;
  const end = py && pm ? new Date(Date.UTC(py, pm, 1) - 1).toISOString() : undefined;

  const { data: opps = [], isLoading, isError } = useQualifiedOpportunitiesByUser({
    organizationId: organization?.id,
    userId,
    start,
    end,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Carregando qualificações...</div>;
  }

  if (isError) {
    return (
      <div className="text-sm text-destructive py-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Erro ao carregar oportunidades qualificadas. Tente novamente.
      </div>
    );
  }

  // Divergência: contador do resumo mostra X mas detalhe trouxe 0.
  if (expectedCount > 0 && opps.length === 0) {
    return (
      <div className="text-sm py-4">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-medium">Divergência detectada</p>
            <p className="text-xs">
              O resumo aponta {expectedCount} leads qualificados, mas o detalhe não retornou registros.
              Revise a fonte de qualificações para este período.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (opps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Nenhum lead qualificado no período.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-sm font-semibold">Leads qualificados ({opps.length})</h5>
        {expectedCount > 0 && opps.length !== expectedCount && (
          <span className="text-xs text-destructive inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Resumo: {expectedCount} · Detalhe: {opps.length}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Qualificado em</TableHead>
              <TableHead>Cliente / Oportunidade</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Resp. histórico</TableHead>
              <TableHead>Resp. atual</TableHead>
              <TableHead className="text-right">Valor vendido</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opps.map((o) => {
              const transferred =
                o.currentOwnerUserId &&
                o.historicalQualifierUserId &&
                o.currentOwnerUserId !== o.historicalQualifierUserId;
              return (
                <TableRow key={o.opportunityId}>
                  <TableCell className="text-sm tabular-nums whitespace-nowrap">
                    {fmtDateTime(o.qualificationAt || o.closedAt)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[280px]">
                    <div className="truncate">{o.accountName || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.title}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.pipelineName || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.origem || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.stageName || '—'}</TableCell>
                  <TableCell className="text-sm">{o.historicalQualifierName || '—'}</TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1">
                      {o.currentOwnerName || '—'}
                      {transferred && (
                        <Badge variant="outline" className="text-[10px] uppercase border-amber-500/40 text-amber-600">
                          Transferido
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmtBRL(o.valueWon)}</TableCell>
                  <TableCell>
                    <a
                      href={`/app/opportunities/${o.opportunityId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Abrir oportunidade"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
