import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, X, AlertTriangle, Download, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Prospect } from '@/hooks/useLeadSourcingV2';
import { DecisionBadge } from '@/components/decision-engine/DecisionBadge';

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected' | 'imported' | 'duplicate' | 'high_score' | 'no_domain';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'imported', label: 'Importados' },
  { key: 'rejected', label: 'Rejeitados' },
  { key: 'duplicate', label: 'Possível Duplicado' },
  { key: 'high_score', label: 'Score Alto' },
  { key: 'no_domain', label: 'Sem Domínio' },
];

interface LeadResultsTableProps {
  prospects: Prospect[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCreateOpportunity: (id: string) => void;
  onImport: (prospect: Prospect) => void;
  onBulkImport: (prospects: Prospect[]) => void;
  onBulkApprove: (ids: string[]) => void;
  onBulkReject: (ids: string[]) => void;
  onOpenDetail: (prospect: Prospect) => void;
  isUpdating: boolean;
  isImporting: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600 bg-green-500/10 border-green-500/20'
    : score >= 50 ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
    : 'text-red-600 bg-red-500/10 border-red-500/20';
  return <Badge variant="outline" className={cn('font-bold', color)}>{score.toFixed(0)}</Badge>;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-500/10 text-green-600 border-green-500/20',
    B: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    C: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    D: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return <Badge variant="outline" className={cn('font-bold', colors[grade] || '')}>{grade}</Badge>;
}

function StatusBadge({ status, approvalStatus }: { status: string; approvalStatus?: string | null }) {
  if (approvalStatus === 'imported' || status === 'converted') {
    return <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
      <PackageCheck className="h-3 w-3 mr-1" />Importado
    </Badge>;
  }
  switch (status) {
    case 'approved': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Aprovado</Badge>;
    case 'rejected': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20" variant="outline">Rejeitado</Badge>;
    default: return <Badge variant="secondary">Pendente</Badge>;
  }
}

function DedupeBadgeSmall({ status }: { status: string }) {
  if (status === 'strong_match') return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Dup.</Badge>;
  if (status === 'possible_match') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-amber-500/50 text-amber-600 bg-amber-500/10"><AlertTriangle className="h-2.5 w-2.5" />Poss.</Badge>;
  return null;
}

export function LeadResultsTable({
  prospects,
  onApprove,
  onReject,
  onCreateOpportunity,
  onImport,
  onBulkImport,
  onBulkApprove,
  onBulkReject,
  onOpenDetail,
  isUpdating,
  isImporting,
}: LeadResultsTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      switch (activeFilter) {
        case 'pending': return p.status === 'review_pending' || p.approval_status === 'pending';
        case 'approved': return p.status === 'approved' || p.approval_status === 'approved';
        case 'rejected': return p.status === 'rejected' || p.approval_status === 'rejected';
        case 'imported': return p.approval_status === 'imported' || p.status === 'converted';
        case 'duplicate': return p.dedupe_status === 'strong_match' || p.dedupe_status === 'possible_match';
        case 'high_score': {
          const s = p.prospect_scores?.[0];
          return s && (s.priority_score >= 70 || ((s.icp_fit_score || 0) + (s.data_quality_score || 0) + (s.source_trust_score || 0) - (s.penalty_score || 0)) >= 70);
        }
        case 'no_domain': return !p.normalized_domain;
        default: return true;
      }
    });
  }, [prospects, activeFilter]);

  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedArray = Array.from(selectedIds);

  // Get approved prospects from selection for bulk import
  const selectedApprovedProspects = useMemo(() => {
    return prospects.filter(p => selectedIds.has(p.id) && (p.status === 'approved' || p.approval_status === 'approved') && p.approval_status !== 'imported');
  }, [prospects, selectedIds]);

  if (!prospects.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            Resultados
            <Badge variant="secondary">{filtered.length} de {prospects.length} leads</Badge>
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => { onBulkApprove(selectedArray); setSelectedIds(new Set()); }} disabled={isUpdating}>
                <Check className="h-3 w-3 mr-1" />Aprovar {selectedIds.size}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => { onBulkReject(selectedArray); setSelectedIds(new Set()); }} disabled={isUpdating}>
                <X className="h-3 w-3 mr-1" />Rejeitar {selectedIds.size}
              </Button>
              {selectedApprovedProspects.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onBulkImport(selectedApprovedProspects); setSelectedIds(new Set()); }} disabled={isImporting}>
                  <Download className="h-3 w-3 mr-1" />Importar {selectedApprovedProspects.length}
                </Button>
              )}
            </div>
          )}
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setActiveFilter(f.key); setSelectedIds(new Set()); }}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                activeFilter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">Confiança</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead>Duplicidade</TableHead>
                <TableHead>Sinais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(prospect => {
                const score = prospect.prospect_scores?.[0];
                const priorityScore = score?.priority_score ?? 0;
                const totalScore = score
                  ? (score.icp_fit_score || 0) + (score.signal_score || 0) + (score.data_quality_score || 0) + (score.source_trust_score || 0) - (score.penalty_score || 0)
                  : 0;
                const displayScore = priorityScore || totalScore;
                const grade = score?.grade ?? '-';
                const reasoning = score?.reasoning as any;
                const signals: string[] = reasoning?.signals || [];
                const isImported = prospect.approval_status === 'imported' || prospect.status === 'converted';

                return (
                  <TableRow key={prospect.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenDetail(prospect)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(prospect.id)} onCheckedChange={() => toggleOne(prospect.id)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {prospect.company_name}
                        {prospect.normalized_domain && (
                          <div className="text-xs text-muted-foreground">{prospect.normalized_domain}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{prospect.source_label || '-'}</TableCell>
                    <TableCell className="text-center">
                      {prospect.confidence != null ? <ScoreBadge score={prospect.confidence} /> : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={displayScore} />
                    </TableCell>
                    <TableCell className="text-center">
                      {grade !== '-' ? <GradeBadge grade={grade} /> : '-'}
                    </TableCell>
                    <TableCell>
                      <DedupeBadgeSmall status={prospect.dedupe_status || 'unchecked'} />
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <div className="flex flex-wrap gap-1">
                        {signals.length > 0 ? signals.slice(0, 3).map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {s.replace(/_/g, ' ')}
                          </Badge>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={prospect.status} approvalStatus={prospect.approval_status} />
                        <DecisionBadge prospectId={prospect.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      {prospect.status === 'review_pending' && (
                        <div className="flex gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => onApprove(prospect.id)} disabled={isUpdating}>
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Aprovar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onReject(prospect.id)} disabled={isUpdating}>
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rejeitar</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      {(prospect.status === 'approved' || prospect.approval_status === 'approved') && !isImported && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onImport(prospect)} disabled={isImporting}>
                              <Download className="h-3 w-3 mr-1" />
                              Importar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Importar no CRM (conta + oportunidade)</TooltipContent>
                        </Tooltip>
                      )}
                      {isImported && (
                        <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                          <PackageCheck className="h-3 w-3 mr-1" />CRM
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
