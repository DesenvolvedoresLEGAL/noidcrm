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
import { Check, X, AlertTriangle, Download, PackageCheck, ArrowUp, ArrowDown, ArrowUpDown, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Prospect } from '@/hooks/useLeadSourcingV2';
import { DecisionBadge } from '@/components/decision-engine/DecisionBadge';
import { RelationshipBadge } from './RelationshipBadge';
import { AutopilotConfigModal } from '@/components/intelligence/autopilot/AutopilotConfigModal';

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected' | 'imported' | 'duplicate' | 'tier_s' | 'tier_a' | 'tier_b' | 'tier_c' | 'high_score' | 'no_domain' | 'rel_customer' | 'rel_opportunity' | 'rel_account' | 'rel_new';

// Tier thresholds — calibrados sobre dados reais (priority_score range observado: 141–316)
// Tier S: alta prioridade absoluta (top 30%)
// Tier A: prioridade alta com ICP forte
// Tier B: segunda onda
// Tier C: descartar ou enriquecer manualmente
const TIER_S_MIN = 280;
const TIER_A_MIN = 230;
const TIER_B_MIN = 180;
// Score Alto = Tier S + Tier A
const HIGH_SCORE_MIN = TIER_A_MIN;

const FILTERS: { key: FilterKey; label: string; tooltip?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'imported', label: 'Importados' },
  { key: 'rejected', label: 'Rejeitados' },
  { key: 'duplicate', label: 'Possível Duplicado' },
  { key: 'high_score', label: 'Score Alto', tooltip: `Inclui Tier S e Tier A (priority_score ≥ ${HIGH_SCORE_MIN}). Combina ICP fit, sinais positivos detectados, qualidade dos dados e ajuste do learning loop.` },
  { key: 'tier_s', label: `Tier S (≥${TIER_S_MIN})`, tooltip: 'Prioridade máxima — atacar primeiro. Alto ICP fit + múltiplos sinais positivos.' },
  { key: 'tier_a', label: `Tier A (${TIER_A_MIN}–${TIER_S_MIN - 1})`, tooltip: 'Alta prioridade — segunda onda imediata. ICP forte com sinais consistentes.' },
  { key: 'tier_b', label: `Tier B (${TIER_B_MIN}–${TIER_A_MIN - 1})`, tooltip: 'Prioridade média — trabalhar após Tier S/A ou enriquecer para subir de tier.' },
  { key: 'tier_c', label: `Tier C (<${TIER_B_MIN})`, tooltip: 'Baixa prioridade — ICP fraco ou poucos sinais. Considerar descarte ou enrichment manual.' },
  { key: 'no_domain', label: 'Sem Domínio' },
  { key: 'rel_customer', label: 'Já é cliente', tooltip: 'Empresa já é cliente ativo no CRM.' },
  { key: 'rel_opportunity', label: 'Em oportunidade', tooltip: 'Já existe oportunidade aberta para esta conta.' },
  { key: 'rel_account', label: 'Já é conta', tooltip: 'Conta já cadastrada, sem oportunidade ativa.' },
  { key: 'rel_new', label: 'Novo na base', tooltip: 'Empresa não encontrada na base — prospect novo.' },
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
  const [sortKey, setSortKey] = useState<'company' | 'score' | 'grade' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: 'company' | 'score' | 'grade') => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'company' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ k }: { k: 'company' | 'score' | 'grade' }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      const s = p.prospect_scores?.[0];
      const priority = s?.priority_score ?? 0;
      switch (activeFilter) {
        case 'pending': return p.status === 'review_pending' || p.approval_status === 'pending';
        case 'approved': return p.status === 'approved' || p.approval_status === 'approved';
        case 'rejected': return p.status === 'rejected' || p.approval_status === 'rejected';
        case 'imported': return p.approval_status === 'imported' || p.status === 'converted';
        case 'duplicate': return p.dedupe_status === 'strong_match' || p.dedupe_status === 'possible_match';
        case 'tier_s': return s && priority >= TIER_S_MIN;
        case 'tier_a': return s && priority >= TIER_A_MIN && priority < TIER_S_MIN;
        case 'tier_b': return s && priority >= TIER_B_MIN && priority < TIER_A_MIN;
        case 'tier_c': return s && priority < TIER_B_MIN;
        case 'high_score': return s && priority >= HIGH_SCORE_MIN;
        case 'no_domain': return !p.normalized_domain;
        case 'rel_customer': return p.relationship_status === 'customer';
        case 'rel_opportunity': return p.relationship_status === 'opportunity_existing';
        case 'rel_account': return p.relationship_status === 'account_existing';
        case 'rel_new': return p.relationship_status === 'new_prospect';
        default: return true;
      }
    });
  }, [prospects, activeFilter]);

  const getDisplayScore = (p: Prospect) => {
    const s = p.prospect_scores?.[0];
    if (!s) return 0;
    const total = (s.icp_fit_score || 0) + (s.signal_score || 0) + (s.data_quality_score || 0) + (s.source_trust_score || 0) - (s.penalty_score || 0);
    return s.priority_score || total;
  };

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === 'company') {
        return (a.company_name || '').localeCompare(b.company_name || '', 'pt-BR', { sensitivity: 'base' }) * dir;
      }
      if (sortKey === 'score') {
        return (getDisplayScore(a) - getDisplayScore(b)) * dir;
      }
      // grade — A < B < C < D; "-" no fim
      const ga = a.prospect_scores?.[0]?.grade ?? 'Z';
      const gb = b.prospect_scores?.[0]?.grade ?? 'Z';
      return ga.localeCompare(gb) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

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
  const [autopilotOpen, setAutopilotOpen] = useState(false);

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
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="default" className="h-7 text-xs"
              onClick={() => setAutopilotOpen(true)}
              disabled={prospects.length === 0}>
              <Rocket className="h-3 w-3 mr-1" /> Executar Autopilot
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => { onBulkApprove(selectedArray); setSelectedIds(new Set()); }} disabled={isUpdating}>
                  <Check className="h-3 w-3 mr-1" />Aprovar {selectedIds.size}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => { onBulkReject(selectedArray); setSelectedIds(new Set()); }} disabled={isUpdating}>
                  <X className="h-3 w-3 mr-1" />Rejeitar {selectedIds.size}
                </Button>
                {selectedApprovedProspects.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onBulkImport(selectedApprovedProspects); setSelectedIds(new Set()); }} disabled={isImporting}>
                    <Download className="h-3 w-3 mr-1" />Enviar para Triagem {selectedApprovedProspects.length}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <AutopilotConfigModal
          open={autopilotOpen}
          onClose={() => setAutopilotOpen(false)}
          defaults={{
            prospect_ids: (selectedIds.size > 0 ? selectedArray : prospects.map(p => p.id)),
            run_name: `Autopilot ${new Date().toLocaleDateString('pt-BR')} (${selectedIds.size > 0 ? selectedIds.size : prospects.length})`,
          }}
        />

        {/* Filters */}
        <TooltipProvider>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {FILTERS.map(f => {
              const btn = (
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
              );
              if (!f.tooltip) return btn;
              return (
                <Tooltip key={f.key}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">{f.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort('company')}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Empresa <SortIcon k="company" />
                  </button>
                </TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">Confiança</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      Confiança da extração de dados pela IA (0–100). Não confundir com o Score de prioridade comercial.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    type="button"
                    onClick={() => toggleSort('score')}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                  >
                    Score <SortIcon k="score" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    type="button"
                    onClick={() => toggleSort('grade')}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                  >
                    Grade <SortIcon k="grade" />
                  </button>
                </TableHead>
                <TableHead>Duplicidade</TableHead>
                <TableHead>Status na base</TableHead>
                <TableHead>Sinais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(prospect => {
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
                    <TableCell>
                      <RelationshipBadge
                        status={prospect.relationship_status}
                        confidence={(prospect as any).match_confidence ?? null}
                        reason={(prospect as any).match_reason ?? null}
                        compact
                      />
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
                        prospect.relationship_status === 'customer' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                                  <Download className="h-3 w-3 mr-1" />
                                  Importar
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Já é cliente — abra a conta existente em vez de importar.</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  if (
                                    prospect.relationship_status === 'opportunity_existing' ||
                                    prospect.relationship_status === 'account_existing'
                                  ) {
                                    const label =
                                      prospect.relationship_status === 'opportunity_existing'
                                        ? 'já existe uma oportunidade aberta'
                                        : 'já existe uma conta cadastrada';
                                    if (!window.confirm(`Atenção: ${label} para esta empresa. Importar mesmo assim?`)) {
                                      return;
                                    }
                                  }
                                  onImport(prospect);
                                }}
                                disabled={isImporting}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Importar
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Importar no CRM (conta + oportunidade)</TooltipContent>
                          </Tooltip>
                        )
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
