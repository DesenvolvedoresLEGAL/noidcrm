import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { listOpportunityHistory, getActionDescription, type AuditLogEntry } from '@/services/crm/audit-log';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, User, GitBranch, CheckCircle2, XCircle, Edit3, Plus, Trash2, RefreshCw, PartyPopper, ArrowRightLeft, FileCheck, Trophy, Star, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

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

export function OpportunityHistoryTab({ opportunityId }: OpportunityHistoryTabProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [winLossRecord, setWinLossRecord] = useState<WinLossRecord | null>(null);

  useEffect(() => {
    loadHistory();
    loadWinLossRecord();
  }, [opportunityId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await listOpportunityHistory(opportunityId);
      setHistory(data);
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'opportunity_created':
        return <Plus className="h-4 w-4" />;
      case 'stage_moved':
        return <GitBranch className="h-4 w-4" />;
      case 'status_changed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'field_updated':
        return <Edit3 className="h-4 w-4" />;
      case 'opportunity_deleted':
        return <Trash2 className="h-4 w-4" />;
      case 'proposal_accepted':
        return <PartyPopper className="h-4 w-4" />;
      case 'handoff_received':
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (action) {
      case 'opportunity_created':
        return 'default';
      case 'status_changed':
        return 'default';
      case 'opportunity_deleted':
        return 'destructive';
      case 'proposal_accepted':
        return 'default';
      case 'handoff_received':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const relative = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    const absolute = date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { relative, absolute };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum histórico ainda</h3>
        <p className="text-sm text-muted-foreground mb-4">
          As alterações nesta oportunidade aparecerão aqui
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadHistory}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Group by date
  const groupedHistory = history.reduce((acc, entry) => {
    const date = formatDateBR(entry.created_at);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, AuditLogEntry[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { loadHistory(); loadWinLossRecord(); }}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Win/Loss Card - Show if there's customer feedback */}
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
      
      <div className="space-y-6">
        {Object.entries(groupedHistory).map(([date, entries]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {date}
            </h3>
            <div className="space-y-3 ml-6 border-l-2 border-border pl-6">
              {entries.map((entry) => {
                const timestamp = formatTimestamp(entry.created_at);
                return (
                  <Card key={entry.id} className="p-4 relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[33px] top-5 w-3 h-3 rounded-full bg-primary border-2 border-background"></div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Show special avatar for external actions */}
                        {entry.action === 'proposal_accepted' ? (
                          <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <FileCheck className="h-4 w-4 text-green-600" />
                          </div>
                        ) : entry.action === 'handoff_received' ? (
                          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                          </div>
                        ) : (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={entry.actor?.avatar_url || undefined} />
                            <AvatarFallback>
                              {entry.actor?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={getActionBadgeVariant(entry.action)} 
                              className={cn(
                                "gap-1",
                                entry.action === 'proposal_accepted' && "bg-green-500/20 text-green-700 border-green-500/30",
                                entry.action === 'handoff_received' && "bg-blue-500/20 text-blue-700 border-blue-500/30"
                              )}
                            >
                              {getActionIcon(entry.action)}
                              {entry.action === 'proposal_accepted' ? 'proposta aceita' : 
                               entry.action === 'handoff_received' ? 'passagem de bastão' :
                               entry.action.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground" title={timestamp.absolute}>
                              {timestamp.relative}
                            </span>
                          </div>
                          
                          <p className="text-sm">
                            {getActionDescription(entry)}
                          </p>
                          
                          {/* Extra details for proposal acceptance */}
                          {entry.action === 'proposal_accepted' && entry.metadata && (
                            <div className="mt-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 text-xs space-y-1">
                              {entry.metadata.proposal_value && (
                                <p className="text-green-700 dark:text-green-400">
                                  <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.metadata.proposal_value)}
                                </p>
                              )}
                              {entry.metadata.acceptor_name && (
                                <p className="text-green-700 dark:text-green-400">
                                  <strong>Aprovado por:</strong> {entry.metadata.acceptor_name}
                                </p>
                              )}
                              {entry.metadata.acceptor_position && (
                                <p className="text-green-700 dark:text-green-400">
                                  <strong>Cargo:</strong> {entry.metadata.acceptor_position}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Extra details for handoff */}
                          {entry.action === 'handoff_received' && entry.metadata && (
                            <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-xs space-y-1">
                              {entry.metadata.source_pipeline_name && (
                                <p className="text-blue-700 dark:text-blue-400">
                                  <strong>Pipeline de origem:</strong> {entry.metadata.source_pipeline_name}
                                </p>
                              )}
                              {entry.metadata.proposal_value && (
                                <p className="text-blue-700 dark:text-blue-400">
                                  <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.metadata.proposal_value)}
                                </p>
                              )}
                              {entry.metadata.source_opportunity_id && (
                                <a 
                                  href={`/app/opportunities/${entry.metadata.source_opportunity_id}`}
                                  className="text-xs text-blue-600 hover:underline block mt-1"
                                >
                                  Ver oportunidade original →
                                </a>
                              )}
                            </div>
                          )}

                          {/* Show if entry was copied from original opportunity */}
                          {entry.metadata?.copied_from_opportunity && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              (Copiado do histórico original)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}