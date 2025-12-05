import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Edit, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePendingApprovals, useApproveAIAction, useRejectAIAction } from '@/hooks/useAISupervision';
import { getActionTypeLabel, getConfidenceInfo, AIAction } from '@/services/crm/ai-supervision';

export function PendingApprovalsCard() {
  const { data: pendingActions, isLoading } = usePendingApprovals();
  const approveAction = useApproveAIAction();
  const rejectAction = useRejectAIAction();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AIAction | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = (actionId: string) => {
    approveAction.mutate(actionId);
  };

  const handleRejectClick = (action: AIAction) => {
    setSelectedAction(action);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedAction && rejectReason.trim()) {
      rejectAction.mutate({ actionId: selectedAction.id, reason: rejectReason });
      setRejectDialogOpen(false);
      setSelectedAction(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Aprovações Pendentes
          </CardTitle>
          <CardDescription>
            Ações da IA aguardando sua aprovação (confidence &lt; 0.7)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : pendingActions && pendingActions.length > 0 ? (
              <div className="space-y-3">
                {pendingActions.map((action) => {
                  const confidenceInfo = getConfidenceInfo(Number(action.confidence_score));
                  const decisionData = action.decision_data as Record<string, unknown>;
                  
                  return (
                    <div 
                      key={action.id} 
                      className="p-4 rounded-lg border bg-card space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {getActionTypeLabel(action.action_type)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {action.entity_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(action.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${confidenceInfo.color}`} />
                          <span className="text-sm font-medium">
                            {Math.round(Number(action.confidence_score) * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Decision Details */}
                      <div className="p-2 rounded bg-muted/50 text-sm">
                        <p className="font-medium mb-1">Decisão proposta:</p>
                        {decisionData.action && (
                          <p>• Ação: {String(decisionData.action)}</p>
                        )}
                        {decisionData.target && (
                          <p>• Destino: {String(decisionData.target)}</p>
                        )}
                        {decisionData.reason && (
                          <p>• Motivo: {String(decisionData.reason)}</p>
                        )}
                      </div>

                      {/* Context */}
                      {action.context_data && Object.keys(action.context_data as object).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Confiança baixa: {(action.context_data as Record<string, unknown>).low_confidence_reason as string || 'dados insuficientes'}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(action.id)}
                          disabled={approveAction.isPending}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRejectClick(action)}
                          disabled={rejectAction.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="px-3"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mb-3 text-green-500" />
                <p className="font-medium">Nenhuma aprovação pendente</p>
                <p className="text-sm">Todas as ações foram processadas</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Ação da IA</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. Este feedback ajudará a IA a melhorar suas decisões.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectAction.isPending}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
