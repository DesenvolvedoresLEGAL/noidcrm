import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, X, ArrowRight, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadSearchResult } from '@/hooks/useLeadSourcing';

interface LeadResultsTableProps {
  results: LeadSearchResult[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCreateOpportunity: (id: string) => void;
  isUpdating: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600 bg-green-500/10 border-green-500/20'
    : score >= 60 ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
    : 'text-red-600 bg-red-500/10 border-red-500/20';
  return <Badge variant="outline" className={cn('font-bold', color)}>{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Aprovado</Badge>;
    case 'rejected': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20" variant="outline">Rejeitado</Badge>;
    case 'converted': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20" variant="outline">Convertido</Badge>;
    default: return <Badge variant="secondary">Pendente</Badge>;
  }
}

export function LeadResultsTable({ results, onApprove, onReject, onCreateOpportunity, isUpdating }: LeadResultsTableProps) {
  if (!results.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Resultados
          <Badge variant="secondary">{results.length} leads</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Por que é um bom lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(result => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.company_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{result.origin || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {[result.city, result.state].filter(Boolean).join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge score={result.score} />
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {result.reason || 'Sem justificativa disponível'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={result.status} /></TableCell>
                  <TableCell className="text-right">
                    {result.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => onApprove(result.id)} disabled={isUpdating}>
                              <Check className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Aprovar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onReject(result.id)} disabled={isUpdating}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rejeitar</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {result.status === 'approved' && !result.opportunity_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCreateOpportunity(result.id)} disabled={isUpdating}>
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Criar Oportunidade
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Criar oportunidade no pipeline</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
