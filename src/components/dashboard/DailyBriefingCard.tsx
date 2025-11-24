import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { generateDailyBriefing, getTodayBriefing, type DailyBriefing } from '@/services/crm/ai-automation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async () => {
    try {
      const existing = await getTodayBriefing();
      setBriefing(existing);
    } catch (error) {
      console.error('Error loading briefing:', error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const newBriefing = await generateDailyBriefing();
      setBriefing(newBriefing);
      toast.success('Briefing diário gerado com sucesso!');
    } catch (error: any) {
      console.error('Error generating briefing:', error);
      toast.error(error.message || 'Erro ao gerar briefing');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  if (!briefing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Briefing Diário AI</CardTitle>
            </div>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Briefing
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Comece seu dia com insights e prioridades inteligentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Clique em "Gerar Briefing" para receber suas prioridades do dia
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Briefing Diário AI</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerate} 
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
        <CardDescription>{briefing.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Priority Actions */}
        {briefing.priority_actions && briefing.priority_actions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Ações Prioritárias ({briefing.priority_actions.length})
            </h4>
            <div className="space-y-2">
              {briefing.priority_actions.map((action, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => action.opportunity_id && navigate(`/app/opportunities`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getPriorityColor(action.priority)}>
                          {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                        <span className="text-sm font-medium">{action.action}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{action.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hot Opportunities */}
        {briefing.hot_opportunities && briefing.hot_opportunities.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Oportunidades Quentes ({briefing.hot_opportunities.length})
            </h4>
            <div className="space-y-2">
              {briefing.hot_opportunities.slice(0, 3).map((opp) => (
                <div 
                  key={opp.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/app/opportunities`)}
                >
                  <span className="text-sm font-medium truncate">{opp.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(opp.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* At Risk Deals */}
        {briefing.at_risk_deals && briefing.at_risk_deals.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Deals em Risco ({briefing.at_risk_deals.length})
            </h4>
            <div className="space-y-2">
              {briefing.at_risk_deals.slice(0, 3).map((deal) => (
                <div 
                  key={deal.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-orange-200 bg-orange-50/50 hover:bg-orange-100/50 transition-colors cursor-pointer dark:border-orange-900 dark:bg-orange-950/20"
                  onClick={() => navigate(`/app/opportunities`)}
                >
                  <span className="text-sm font-medium truncate">{deal.title}</span>
                  <Badge variant="outline" className="text-orange-600">
                    {deal.days_since_contact}d sem contato
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
