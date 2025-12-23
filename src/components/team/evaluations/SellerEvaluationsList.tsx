import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSellerEvaluations } from '@/hooks/useSellerEvaluations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, Trash2, Loader2, FileText, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerEvaluationsListProps {
  onViewEvaluation?: (id: string) => void;
}

export function SellerEvaluationsList({ onViewEvaluation }: SellerEvaluationsListProps) {
  const { evaluations, loading, approveEvaluation, rejectEvaluation, deleteEvaluation } = useSellerEvaluations();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveEvaluation(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectEvaluation(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      await deleteEvaluation(deleteId);
    } finally {
      setActionLoading(null);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Rascunho</Badge>;
      case 'submitted':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhuma avaliação encontrada</p>
          <p className="text-sm text-muted-foreground">Crie a primeira avaliação de FitScore</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Avaliações de FitScore</CardTitle>
          <CardDescription>
            Lista de avaliações de vendedores e seus status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Fit Cultural</TableHead>
                <TableHead className="text-center">Desempenho</TableHead>
                <TableHead className="text-center">FitScore</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Avaliador</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((evaluation) => (
                <TableRow key={evaluation.id}>
                  <TableCell className="font-medium">
                    {evaluation.seller?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(evaluation.period_start), 'dd/MM/yy', { locale: ptBR })} -{' '}
                    {format(new Date(evaluation.period_end), 'dd/MM/yy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className={cn('text-center font-medium', getScoreColor(evaluation.cultural_fit_score))}>
                    {evaluation.cultural_fit_score}
                  </TableCell>
                  <TableCell className={cn('text-center font-medium', getScoreColor(evaluation.performance_score))}>
                    {evaluation.performance_score}
                  </TableCell>
                  <TableCell className={cn('text-center font-bold text-lg', getScoreColor(evaluation.fit_score))}>
                    {evaluation.fit_score}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(evaluation.status)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {evaluation.evaluator?.full_name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onViewEvaluation && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewEvaluation(evaluation.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {evaluation.status === 'submitted' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-500 hover:text-green-600"
                            onClick={() => handleApprove(evaluation.id)}
                            disabled={actionLoading === evaluation.id}
                          >
                            {actionLoading === evaluation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleReject(evaluation.id)}
                            disabled={actionLoading === evaluation.id}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {evaluation.status !== 'approved' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(evaluation.id)}
                          disabled={actionLoading === evaluation.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A avaliação será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
