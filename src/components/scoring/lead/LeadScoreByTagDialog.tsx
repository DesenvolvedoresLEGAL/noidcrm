import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountsByTagWithScore } from '@/hooks/useLeadScoreByTag';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: { id: string; name: string; color: string } | null;
}

export function LeadScoreByTagDialog({ open, onOpenChange, tag }: Props) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useAccountsByTagWithScore(tag?.id);

  const openAccount = (id: string) => {
    onOpenChange(false);
    navigate(`/app/accounts/${id}/edit`);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null || score === undefined) return 'text-muted-foreground bg-muted';
    if (score >= 70) return 'text-green-600 bg-green-500/10';
    if (score >= 50) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-red-600 bg-red-500/10';
  };

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case 'A':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'B':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'C':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'D':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            {tag && (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: tag.color }}
                aria-hidden
              />
            )}
            Empresas com a TAG: {tag?.name ?? '—'}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? 'Carregando…' : `${rows.length} contas vinculadas, ordenadas por Lead Score`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta vinculada a esta TAG
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => openAccount(r.id)}
                    className="w-full grid grid-cols-[1fr_auto] items-center gap-3 p-3 rounded-lg border hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.razao_social}</div>
                      {r.nome_fantasia && (
                        <div className="text-xs text-muted-foreground truncate">
                          {r.nome_fantasia}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn('font-mono w-8 justify-center', getGradeColor(r.lead_grade))}
                      >
                        {r.lead_grade ?? '–'}
                      </Badge>
                      <Badge
                        className={cn(
                          'font-mono font-bold w-12 justify-center',
                          getScoreColor(r.lead_score),
                        )}
                      >
                        {r.lead_score ?? '–'}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAccount(r.id);
                        }}
                        className="gap-1.5 opacity-80 group-hover:opacity-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
