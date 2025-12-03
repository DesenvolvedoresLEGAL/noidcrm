import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ScoreHistoryModalProps {
  entityType: 'account' | 'opportunity';
  entityId: string;
  entityName?: string;
  trigger?: React.ReactNode;
}

interface ScoreHistoryEntry {
  id: string;
  score_type: string;
  old_value: number | null;
  new_value: number;
  change_reason: string | null;
  factors: Record<string, any> | null;
  created_at: string;
}

export function ScoreHistoryModal({ 
  entityType, 
  entityId, 
  entityName,
  trigger 
}: ScoreHistoryModalProps) {
  const [open, setOpen] = useState(false);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['score-history', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('score_history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ScoreHistoryEntry[];
    },
    enabled: open,
  });

  const getScoreTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fit: 'FIT Score',
      intent: 'INTENT Score',
      lead: 'Lead Score',
      engagement: 'Engajamento',
      velocity: 'Velocidade',
      risk: 'Risco',
      opportunity: 'Score Geral',
      win_probability: 'Win Probability (AI)',
    };
    return labels[type] || type;
  };

  const getChangeIcon = (oldVal: number | null, newVal: number) => {
    if (oldVal === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (newVal > oldVal) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (newVal < oldVal) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getChangeColor = (oldVal: number | null, newVal: number) => {
    if (oldVal === null) return 'text-muted-foreground';
    if (newVal > oldVal) return 'text-emerald-500';
    if (newVal < oldVal) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const formatChange = (oldVal: number | null, newVal: number) => {
    if (oldVal === null) return `→ ${newVal}`;
    const diff = newVal - oldVal;
    const sign = diff > 0 ? '+' : '';
    return `${oldVal} → ${newVal} (${sign}${diff})`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
            <History className="h-3 w-3" />
            Histórico
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Score
            {entityName && <span className="text-muted-foreground font-normal">- {entityName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum histórico de score encontrado.</p>
              <p className="text-xs mt-1">O histórico será registrado após o primeiro recálculo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg border bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(entry.old_value, entry.new_value)}
                      <Badge variant="outline" className="text-[10px]">
                        {getScoreTypeLabel(entry.score_type)}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(entry.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className={cn('text-sm font-semibold', getChangeColor(entry.old_value, entry.new_value))}>
                    {formatChange(entry.old_value, entry.new_value)}
                  </div>

                  {entry.change_reason && (
                    <p className="text-xs text-muted-foreground">
                      {entry.change_reason}
                    </p>
                  )}

                  {entry.factors && Object.keys(entry.factors).length > 0 && (
                    <div className="text-[10px] text-muted-foreground pt-1 border-t">
                      <span className="font-medium">Fatores:</span>{' '}
                      {Object.entries(entry.factors)
                        .slice(0, 3)
                        .map(([key, val]) => `${key}: ${val}`)
                        .join(', ')}
                      {Object.keys(entry.factors).length > 3 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
