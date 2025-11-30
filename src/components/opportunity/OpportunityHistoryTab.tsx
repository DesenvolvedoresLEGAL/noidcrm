import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { listOpportunityHistory, getActionDescription, type AuditLogEntry } from '@/services/crm/audit-log';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, User, GitBranch, CheckCircle2, XCircle, Edit3, Plus, Trash2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';

interface OpportunityHistoryTabProps {
  opportunityId: string;
}

export function OpportunityHistoryTab({ opportunityId }: OpportunityHistoryTabProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
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
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" => {
    switch (action) {
      case 'opportunity_created':
        return 'default';
      case 'status_changed':
        return 'default';
      case 'opportunity_deleted':
        return 'destructive';
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
          onClick={loadHistory}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>
      
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
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.actor?.avatar_url || undefined} />
                          <AvatarFallback>
                            {entry.actor?.full_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getActionBadgeVariant(entry.action)} className="gap-1">
                              {getActionIcon(entry.action)}
                              {entry.action.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground" title={timestamp.absolute}>
                              {timestamp.relative}
                            </span>
                          </div>
                          
                          <p className="text-sm">
                            {getActionDescription(entry)}
                          </p>
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
