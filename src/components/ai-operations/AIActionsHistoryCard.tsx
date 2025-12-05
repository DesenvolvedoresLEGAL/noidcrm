import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRecentAIActions } from '@/hooks/useAISupervision';
import { getActionTypeLabel, getConfidenceInfo } from '@/services/crm/ai-supervision';

const statusIcons: Record<string, React.ReactNode> = {
  auto_executed: <CheckCircle className="h-4 w-4 text-green-500" />,
  executed_notified: <CheckCircle className="h-4 w-4 text-blue-500" />,
  awaiting_approval: <Clock className="h-4 w-4 text-orange-500" />,
  approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
  overridden: <Edit className="h-4 w-4 text-purple-500" />,
  pending: <Clock className="h-4 w-4 text-gray-500" />,
};

const statusLabels: Record<string, string> = {
  auto_executed: 'Auto-executado',
  executed_notified: 'Executado',
  awaiting_approval: 'Aguardando',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  overridden: 'Corrigido',
  pending: 'Pendente',
};

const statusColors: Record<string, string> = {
  auto_executed: 'bg-green-500/10 text-green-500 border-green-500/20',
  executed_notified: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  awaiting_approval: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  approved: 'bg-green-500/10 text-green-500 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  overridden: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  pending: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export function AIActionsHistoryCard() {
  const { data: actions, isLoading } = useRecentAIActions(30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Histórico de Ações (24h)
        </CardTitle>
        <CardDescription>
          Todas as decisões tomadas pela IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : actions && actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map((action) => {
                const confidenceInfo = getConfidenceInfo(Number(action.confidence_score));
                
                return (
                  <div 
                    key={action.id} 
                    className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {statusIcons[action.status]}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {getActionTypeLabel(action.action_type)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {action.entity_type}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${statusColors[action.status]}`}
                            >
                              {statusLabels[action.status]}
                            </Badge>
                          </div>
                          
                          {/* Decision summary */}
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {(action.decision_data as Record<string, unknown>)?.action as string || 
                             (action.decision_data as Record<string, unknown>)?.reason as string || 
                             'Decisão processada'}
                          </p>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(action.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${confidenceInfo.color}`} />
                              <span>{Math.round(Number(action.confidence_score) * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Override info */}
                    {action.status === 'overridden' && action.override_reason && (
                      <div className="mt-2 p-2 rounded bg-purple-500/10 text-xs">
                        <AlertTriangle className="h-3 w-3 inline mr-1 text-purple-500" />
                        Corrigido: {action.override_reason}
                      </div>
                    )}
                    
                    {/* Rejection info */}
                    {action.status === 'rejected' && action.override_reason && (
                      <div className="mt-2 p-2 rounded bg-red-500/10 text-xs">
                        <XCircle className="h-3 w-3 inline mr-1 text-red-500" />
                        Motivo: {action.override_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">Nenhuma ação registrada</p>
              <p className="text-sm">As ações da IA aparecerão aqui</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
