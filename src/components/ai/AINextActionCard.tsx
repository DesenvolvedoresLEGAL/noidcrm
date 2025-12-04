import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Phone, Mail, Calendar, FileText, Clock, Loader2, Plus, X, RefreshCw } from 'lucide-react';
import { useAINextActions } from '@/hooks/useAINextActions';
import { type NextAction } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';

interface AINextActionCardProps {
  opportunityId: string;
  onCreateActivity?: (data: {
    type: string;
    title: string;
    description: string;
    scheduled_date?: string;
  }) => void;
}

export function AINextActionCard({ opportunityId, onCreateActivity }: AINextActionCardProps) {
  const { 
    actions, 
    overallStrategy, 
    urgencyLevel, 
    loading, 
    generating, 
    generate, 
    acceptAction, 
    dismissAction 
  } = useAINextActions(opportunityId);
  const { toast } = useToast();

  const getActionIcon = (type: string) => {
    const icons = {
      call: Phone,
      email: Mail,
      meeting: Calendar,
      proposal: FileText,
      'follow-up': Clock,
    };
    const Icon = icons[type as keyof typeof icons] || Clock;
    return <Icon className="h-4 w-4" />;
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return variants[priority as keyof typeof variants] || variants.medium;
  };

  const getUrgencyBadge = (urgency: string) => {
    const variants = {
      high: 'bg-red-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return variants[urgency as keyof typeof variants] || variants.medium;
  };

  const mapActionTypeToActivityType = (actionType: string): string => {
    const typeMap: Record<string, string> = {
      call: 'call',
      email: 'email',
      meeting: 'meeting',
      proposal: 'task',
      'follow-up': 'task',
    };
    return typeMap[actionType] || 'task';
  };

  const calculateScheduledDate = (timing: string): string => {
    const now = new Date();
    let targetDate = new Date();

    switch (timing) {
      case 'now':
      case 'today':
        break;
      case 'this-week':
        targetDate.setDate(now.getDate() + 3);
        break;
      case 'next-week':
        targetDate.setDate(now.getDate() + 7);
        break;
      default:
        targetDate.setDate(now.getDate() + 1);
    }

    return targetDate.toISOString().split('T')[0];
  };

  const handleCreateActivityFromAction = async (actionId: string, action: NextAction) => {
    if (!onCreateActivity) return;

    onCreateActivity({
      type: mapActionTypeToActivityType(action.type),
      title: action.title,
      description: `${action.description}\n\nMotivo: ${action.reason}`,
      scheduled_date: calculateScheduledDate(action.timing),
    });

    // Mark as accepted in database
    await acceptAction(actionId);

    toast({
      title: 'Atividade criada',
      description: `"${action.title}" foi adicionada às suas atividades.`,
    });
  };

  const handleDismissAction = async (actionId: string) => {
    await dismissAction(actionId);
  };

  const hasActions = actions.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Próximas Ações (AI)</CardTitle>
          </div>
          <Button onClick={generate} disabled={generating || loading} size="sm" variant="outline">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                {hasActions ? (
                  <RefreshCw className="h-4 w-4 mr-2" />
                ) : (
                  <Lightbulb className="h-4 w-4 mr-2" />
                )}
                {hasActions ? 'Atualizar' : 'Gerar'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasActions ? (
          <div className="text-center py-6 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Clique em "Gerar" para ver as próximas ações sugeridas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Estratégia geral */}
            {overallStrategy && (
              <div className="p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  {urgencyLevel && (
                    <>
                      <div className={`w-2 h-2 rounded-full ${getUrgencyBadge(urgencyLevel)}`} />
                      <span className="text-xs font-semibold">
                        Urgência: {urgencyLevel === 'high' ? 'Alta' : urgencyLevel === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{overallStrategy}</p>
              </div>
            )}

            {/* Lista de ações */}
            <div className="space-y-3">
              {actions.map(({ id, action }) => (
                <div key={id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getActionIcon(action.type)}
                      <h4 className="font-medium text-sm truncate">{action.title}</h4>
                    </div>
                    <Badge className={getPriorityBadge(action.priority)} variant="secondary">
                      {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                  
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline" className="text-[10px] py-0">
                      {action.timing === 'now' ? 'Agora' : 
                       action.timing === 'today' ? 'Hoje' :
                       action.timing === 'this-week' ? 'Esta semana' : 'Próxima semana'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] py-0">
                      Impacto: {action.estimated_impact === 'high' ? 'Alto' : 
                               action.estimated_impact === 'medium' ? 'Médio' : 'Baixo'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t gap-2">
                    <span className="text-[10px] text-muted-foreground italic line-clamp-1 flex-1">
                      {action.reason}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDismissAction(id)}
                      >
                        <X className="h-3 w-3" />
                        Ignorar
                      </Button>
                      {onCreateActivity && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-primary hover:text-primary"
                          onClick={() => handleCreateActivityFromAction(id, action)}
                        >
                          <Plus className="h-3 w-3" />
                          Criar Atividade
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
