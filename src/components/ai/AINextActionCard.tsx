import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Phone, Mail, Calendar, FileText, Clock, Loader2 } from 'lucide-react';
import { getNextActions, type NextActions } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';

interface AINextActionCardProps {
  opportunityId: string;
}

export function AINextActionCard({ opportunityId }: AINextActionCardProps) {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<NextActions | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const result = await getNextActions(opportunityId);
      setActions(result);
    } catch (error) {
      console.error('Error getting next actions:', error);
      toast({
        title: 'Erro ao gerar ações',
        description: 'Não foi possível gerar as próximas ações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle>Próximas Ações (AI)</CardTitle>
          </div>
          <Button onClick={handleGenerate} disabled={loading} size="sm">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                Gerar
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!actions ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Clique em "Gerar" para ver as próximas ações sugeridas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Estratégia geral */}
            <div className="p-4 bg-primary/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${getUrgencyBadge(actions.urgency_level)}`} />
                <span className="text-sm font-semibold">
                  Urgência: {actions.urgency_level === 'high' ? 'Alta' : actions.urgency_level === 'medium' ? 'Média' : 'Baixa'}
                </span>
              </div>
              <p className="text-sm">{actions.overall_strategy}</p>
            </div>

            {/* Lista de ações */}
            <div className="space-y-4">
              {actions.actions.map((action, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getActionIcon(action.type)}
                      <h4 className="font-semibold">{action.title}</h4>
                    </div>
                    <Badge className={getPriorityBadge(action.priority)} variant="secondary">
                      {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline" className="text-xs">
                      {action.timing === 'now' ? 'Agora' : 
                       action.timing === 'today' ? 'Hoje' :
                       action.timing === 'this-week' ? 'Esta semana' : 'Próxima semana'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Impacto: {action.estimated_impact === 'high' ? 'Alto' : 
                               action.estimated_impact === 'medium' ? 'Médio' : 'Baixo'}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <span className="font-semibold">Por quê:</span> {action.reason}
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
