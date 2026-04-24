import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Tags, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useLeadScoreByTag } from '@/hooks/useLeadScoreByTag';
import { LeadScoreByTagDialog } from './LeadScoreByTagDialog';

export function LeadScoreByTag() {
  const { organization } = useCurrentOrganization();
  const { data: stats = [], isLoading } = useLeadScoreByTag(organization?.id);
  const [openTag, setOpenTag] = useState<{ id: string; name: string; color: string } | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-500/10';
    if (score >= 50) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-red-600 bg-red-500/10';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Lead Score por TAG
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Média do Lead Score por TAG comercial. Clique em uma TAG para ver todas as
                  empresas vinculadas com seu respectivo score.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma TAG vinculada a contas
            </div>
          ) : (
            <div className="space-y-3">
              {stats.map((stat, index) => (
                <button
                  type="button"
                  key={stat.tagId}
                  onClick={() => setOpenTag({ id: stat.tagId, name: stat.name, color: stat.color })}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-sm font-medium text-muted-foreground w-6">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: stat.color }}
                          aria-hidden
                        />
                        <span className="truncate">{stat.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.count} contas</div>
                    </div>
                  </div>
                  <Badge className={cn('font-mono font-bold', getScoreColor(stat.averageScore))}>
                    Score: {stat.averageScore}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LeadScoreByTagDialog
        open={!!openTag}
        onOpenChange={(o) => !o && setOpenTag(null)}
        tag={openTag}
      />
    </>
  );
}
