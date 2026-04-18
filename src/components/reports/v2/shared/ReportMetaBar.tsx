/**
 * Sprint 2.7 — Barra de metadados padrão dos relatórios V2.
 * Mostra: badge V2 + generatedAt + rowCount + ReportConfidenceBadge.
 */
import { Badge } from '@/components/ui/badge';
import { Sparkles, Clock, Database } from 'lucide-react';
import { ReportConfidenceBadge } from './ReportConfidenceBadge';
import { formatDateTimeBR } from '@/lib/reports/formatReportNumbers';
import type { ReportMeta } from '@/types/reportEdgeV2';

interface Props {
  meta: ReportMeta | null | undefined;
  reportLabel?: string;
}

export function ReportMetaBar({ meta, reportLabel }: Props) {
  if (!meta) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      <Badge
        variant="outline"
        className="gap-1 border-primary/30 bg-primary/10 text-primary"
      >
        <Sparkles className="h-3 w-3" />
        {reportLabel ? `${reportLabel} · V2` : 'V2 ativo'}
      </Badge>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Atualizado em {formatDateTimeBR(meta.generatedAt)}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Database className="h-3 w-3" />
        <span>{meta.rowCount} {meta.rowCount === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div className="ml-auto">
        <ReportConfidenceBadge
          level={meta.confidence?.level ?? meta.status === 'unavailable' ? 'unavailable' : 'high'}
          score={meta.confidence?.score}
        />
      </div>
    </div>
  );
}
