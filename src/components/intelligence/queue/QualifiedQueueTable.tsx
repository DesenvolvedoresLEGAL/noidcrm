import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { QualifiedQueueItem, QualificationStatus } from '@/services/intelligence/qualifiedQueue';
import { QualifiedQueueRowActions } from './QualifiedQueueRowActions';
import { CoverageBadge } from '@/components/intelligence/coverage/CoverageBadge';
import type { CoverageClass } from '@/services/intelligence/coverage';

function relationshipBadge(rel?: string | null) {
  switch (rel) {
    case 'customer':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">🟢 Cliente</Badge>;
    case 'opportunity_existing':
      return <Badge className="bg-orange-500 hover:bg-orange-600">🟠 Oportunidade</Badge>;
    case 'account_existing':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">🟡 Conta</Badge>;
    default:
      return <Badge variant="outline">⚪ Novo</Badge>;
  }
}

function statusBadge(s: QualificationStatus) {
  const map: Record<QualificationStatus, string> = {
    captured: 'Capturado',
    existing_customer: 'Cliente existente',
    existing_account: 'Conta existente',
    duplicate: 'Duplicado',
    enriched: 'Enriquecido',
    decision_maker_found: 'Decisor encontrado',
    contact_revealed: 'Contato revelado',
    approach_ready: 'Brief pronto',
    ready_for_sdr: 'Pronto para SDR',
    human_review: 'Em revisão',
    imported: 'Importado',
    discarded: 'Descartado',
  };
  const variant =
    s === 'ready_for_sdr'
      ? 'default'
      : s === 'human_review'
        ? 'destructive'
        : s === 'imported'
          ? 'secondary'
          : 'outline';
  return <Badge variant={variant as any}>{map[s]}</Badge>;
}

interface Props {
  items: QualifiedQueueItem[];
  onOpenBrief: (item: QualifiedQueueItem) => void;
}

export function QualifiedQueueTable({ items, onOpenBrief }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12 border rounded-lg">
        Nenhum item na fila para os filtros atuais.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>ICP</TableHead>
            <TableHead>Cobertura</TableHead>
            <TableHead>Relacionamento</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Enriquecimento</TableHead>
            <TableHead>Decisor</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <div className="font-medium">{i.company_name}</div>
                {i.domain && <div className="text-xs text-muted-foreground">{i.domain}</div>}
              </TableCell>
              <TableCell>{i.icp_match ? <Badge variant="secondary">ICP</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
              <TableCell>{relationshipBadge(i.relationship_status)}</TableCell>
              <TableCell><span className="font-semibold">{i.score}</span></TableCell>
              <TableCell>{i.grade ?? '—'}</TableCell>
              <TableCell className="text-xs">{i.enrichment_status ?? '—'}</TableCell>
              <TableCell className="text-xs">{i.decision_maker_status ?? '—'}</TableCell>
              <TableCell className="text-xs">{i.contact_status ?? '—'}</TableCell>
              <TableCell>{statusBadge(i.qualification_status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(i.created_at).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                <QualifiedQueueRowActions item={i} onOpenBrief={onOpenBrief} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
