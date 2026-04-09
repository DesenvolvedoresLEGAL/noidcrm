import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Prospect } from '@/hooks/useLeadSourcingV2';

interface LeadResultsTableProps {
  prospects: Prospect[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCreateOpportunity: (id: string) => void;
  isUpdating: boolean;
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Aprovado</Badge>;
    case 'rejected': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20" variant="outline">Rejeitado</Badge>;
    case 'converted': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20" variant="outline">Convertido</Badge>;
    default: return <Badge variant="secondary">Pendente</Badge>;
  }
}

export function LeadResultsTable({ prospects, onApprove, onReject, onCreateOpportunity, isUpdating }: LeadResultsTableProps) {
  if (!prospects.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Resultados
          <Badge variant="secondary">{prospects.length} leads</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Indústria</TableHead>
                <TableHead className="text-center">Confiança</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead>Sinais</TableHead>
                <TableHead>Próxima Ação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map(prospect => {
                const score = prospect.prospect_scores?.[0];
                const priorityScore = score?.priority_score ?? 0;
                const grade = score?.grade ?? '-';
                const reasoning = score?.reasoning as any;
                const signals: string[] = reasoning?.signals || [];

                return (
                  <TableRow key={prospect.id}>
                    <TableCell className="font-medium">
                      <div>
                        {prospect.company_name}
                        {prospect.normalized_domain && (
                          <div className="text-xs text-muted-foreground">{prospect.normalized_domain}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{prospect.source_label || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{prospect.industry || '-'}</TableCell>
                    <TableCell className="text-center">
                      {prospect.confidence != null ? <ScoreBadge score={prospect.confidence} /> : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={priorityScore} />
                    </TableCell>
                    <TableCell className="text-center">
                      {grade !== '-' ? <GradeBadge grade={grade} /> : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {signals.length > 0 ? signals.map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {s.replace(/_/g, ' ')}
                          </Badge>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                      {prospect.recommended_next_action || '-'}
                    </TableCell>
                    <TableCell><StatusBadge status={prospect.status} /></TableCell>
                    <TableCell className="text-right">
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
                      {prospect.status === 'approved' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCreateOpportunity(prospect.id)} disabled={isUpdating}>
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Criar Oportunidade
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Criar oportunidade no pipeline</TooltipContent>
                        </Tooltip>
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
