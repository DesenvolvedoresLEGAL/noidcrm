import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Phone, Mail, Calendar, Percent, Clock, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createActivity } from '@/services/supabase/activities';
import { useProposalAIInsights } from '@/hooks/useProposalAIInsights';

interface RecommendedActionsGridProps {
  proposalId: string;
  opportunityId?: string;
}

const actionTypeMap: Record<string, string> = {
  call: 'call',
  email: 'email',
  meeting: 'meeting',
  discount: 'follow_up',
  follow_up: 'follow_up',
};

function getActionIcon(type: string) {
  switch (type) {
    case 'call': return <Phone className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    case 'meeting': return <Calendar className="h-4 w-4" />;
    case 'discount': return <Percent className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

function getPriorityStyles(priority: string) {
  switch (priority) {
    case 'high':
      return 'border-l-4 border-l-red-500 bg-red-500/5';
    case 'medium':
      return 'border-l-4 border-l-yellow-500 bg-yellow-500/5';
    default:
      return 'border-l-4 border-l-muted bg-muted/10';
  }
}

function getPriorityLabel(priority: string) {
  return priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa';
}

export function RecommendedActionsGrid({ proposalId, opportunityId }: RecommendedActionsGridProps) {
  const { data, isLoading } = useProposalAIInsights(proposalId);
  const [creatingActivity, setCreatingActivity] = useState<number | null>(null);

  const recommendedActions = data?.recommended_actions || [];

  const handleCreateActivity = async (action: any, idx: number) => {
    if (!opportunityId) {
      toast.error('Oportunidade não vinculada');
      return;
    }
    setCreatingActivity(idx);
    try {
      await createActivity({
        title: (action.message || action.title || 'Ação recomendada').slice(0, 100),
        type: (actionTypeMap[action.type] || 'task') as any,
        description: `[AI Insight] ${action.message || action.description || ''}\n\nPrioridade: ${action.priority || 'medium'}`,
        opportunity_id: opportunityId,
        status: 'pending',
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success('Atividade criada com sucesso');
    } catch {
      toast.error('Erro ao criar atividade');
    } finally {
      setCreatingActivity(null);
    }
  };

  if (isLoading || recommendedActions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Ações Recomendadas
          <Badge variant="secondary" className="ml-auto text-xs">
            {recommendedActions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendedActions.map((action: any, idx: number) => (
            <div
              key={idx}
              className={`rounded-lg p-3 flex flex-col gap-3 ${getPriorityStyles(action.priority)}`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 text-muted-foreground">{getActionIcon(action.type)}</div>
                <p className="text-sm flex-1 leading-snug">{action.message || action.title}</p>
                <Badge variant="outline" className="text-xs shrink-0">
                  {getPriorityLabel(action.priority)}
                </Badge>
              </div>
              {opportunityId && (
                <div className="flex justify-end mt-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={creatingActivity === idx}
                    onClick={() => handleCreateActivity(action, idx)}
                  >
                    {creatingActivity === idx
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Plus className="h-3 w-3" />}
                    Criar Atividade
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
