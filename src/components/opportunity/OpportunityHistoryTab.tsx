import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, Trophy, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEventCard } from './TimelineEventCard';
import { SemanticAnalysisCard } from '@/components/intelligence/winloss/SemanticAnalysisCard';
import {
  getEnhancedTimeline,
  LIMIT_OPTIONS,
  type EnhancedTimelineEvent,
  type LimitOption
} from '@/services/crm/enhanced-timeline';

interface OpportunityHistoryTabProps {
  opportunityId: string;
}

interface WinLossRecord {
  id: string;
  outcome: string;
  win_reason_id: string | null;
  key_differentiator: string | null;
  customer_feedback: string | null;
  acceptor_name: string | null;
  recorded_by_customer: boolean | null;
  win_reason?: {
    name: string;
  } | null;
}

// Limit chips configuration
const LIMIT_CHIPS = [10, 25, 50, 100, 200] as const;

export function OpportunityHistoryTab({ opportunityId }: OpportunityHistoryTabProps) {
  const { toast } = useToast();
  const [events, setEvents] = useState<EnhancedTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [winLossRecord, setWinLossRecord] = useState<WinLossRecord | null>(null);
  
  // Limit for records
  const [limit, setLimit] = useState<LimitOption>(50);

  useEffect(() => {
    loadHistory();
    loadWinLossRecord();
  }, [opportunityId, limit]);

  // Realtime: refresh the history when an AI agent emits/updates an approval,
  // run, or email — so the "rascunho aguardando aprovação" event appears
  // without a hard refresh.
  useEffect(() => {
    if (!opportunityId) return;
    const refresh = () => loadHistory();
    const channel = supabase
      .channel(`opp-history-${opportunityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_approval_queue' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_execution_runs' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_email_messages' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log', filter: `entity_id=eq.${opportunityId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getEnhancedTimeline({
        opportunityId,
        limit,
      });
      setEvents(data);
    } catch (error) {
      console.error('Error loading history:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar histórico',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWinLossRecord = async () => {
    try {
      const { data, error } = await supabase
        .from('win_loss_records')
        .select(`
          id,
          outcome,
          win_reason_id,
          key_differentiator,
          customer_feedback,
          acceptor_name,
          recorded_by_customer,
          win_reason:win_reasons(name)
        `)
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (!error && data) {
        setWinLossRecord(data as unknown as WinLossRecord);
      }
    } catch (error) {
      console.error('Error loading win/loss record:', error);
    }
  };

  const getDifferentiatorLabel = (diff: string): string => {
    const labels: Record<string, string> = {
      'Preço': 'Preço',
      'Produto': 'Produto',
      'Atendimento': 'Atendimento',
      'Marca': 'Marca',
      'Relacionamento': 'Relacionamento',
      'Timing': 'Timing',
    };
    return labels[diff] || diff;
  };


  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = formatDateBR(event.timestamp);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, EnhancedTimelineEvent[]>);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Win/Loss Card */}
      {winLossRecord && winLossRecord.outcome === 'won' && (winLossRecord.win_reason_id || winLossRecord.key_differentiator || winLossRecord.customer_feedback) && (
        <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-300">
                  Feedback do Cliente na Aprovação
                </h4>
                {winLossRecord.acceptor_name && (
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Aprovado por: {winLossRecord.acceptor_name}
                  </p>
                )}
              </div>

              {winLossRecord.win_reason && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase">
                    Por que nos escolheu
                  </p>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {winLossRecord.win_reason.name}
                    </span>
                  </div>
                </div>
              )}

              {winLossRecord.key_differentiator && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase">
                    Diferenciais Decisivos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {winLossRecord.key_differentiator.split(',').map((diff, idx) => (
                      <Badge key={idx} variant="outline" className="bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200">
                        {getDifferentiatorLabel(diff.trim())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {winLossRecord.customer_feedback && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase">
                    Comentário do Cliente
                  </p>
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-green-600 mt-0.5" />
                    <p className="text-sm text-green-800 dark:text-green-200 italic">
                      "{winLossRecord.customer_feedback}"
                    </p>
                  </div>
                </div>
              )}

              {winLossRecord.recorded_by_customer && (
                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700">
                  ✓ Feedback registrado pelo próprio cliente
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum histórico encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            As alterações nesta oportunidade aparecerão aqui
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([date, dayEvents]) => (
            <div key={date}>
              {/* Date header with inline chips */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                <Badge variant="outline" className="text-xs">
                  {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                </Badge>
                
                {/* Inline Quantity Chips - only show on first group */}
                {Object.keys(groupedEvents)[0] === date && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">Últimos:</span>
                    <div className="flex gap-1">
                      {LIMIT_CHIPS.map((opt) => (
                        <Button
                          key={opt}
                          variant={limit === opt ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-6 px-2 text-xs font-medium transition-all",
                            limit === opt && "shadow-sm"
                          )}
                          onClick={() => setLimit(opt)}
                        >
                          {opt}
                        </Button>
                      ))}
                      <Button
                        variant={limit === 300 ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-xs font-medium transition-all",
                          limit === 300 && "shadow-sm"
                        )}
                        onClick={() => setLimit(300)}
                      >
                        Todos
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3 ml-6 border-l-2 border-border pl-6">
                {dayEvents.map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
