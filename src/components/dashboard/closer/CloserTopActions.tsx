import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, Info } from 'lucide-react';
import type { CloserNextAction } from '@/types/dashboard/closer';
import { buildCloserCtaHref, severityBadgeVariant, SEVERITY_LABEL } from './closerCta';

export function CloserTopActions({ actions }: { actions: CloserNextAction[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 10 ações do dia</CardTitle>
        <p className="text-xs text-muted-foreground">
          As 10 prioridades comerciais de hoje, em ordem de impacto.
        </p>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Sem ações prioritárias agora. Bom momento para prospectar.
          </p>
        ) : (
          <ol className="space-y-1">
            {actions.map((a, idx) => {
              const href = a.proposal_id
                ? buildCloserCtaHref('proposal', a.proposal_id, a.opportunity_id)
                : buildCloserCtaHref('opportunity', null, a.opportunity_id);
              return (
                <li key={`${a.type}-${idx}`} className="py-1.5 border-b last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                        <Badge variant={severityBadgeVariant(a.severity)} className="text-xs">
                          {SEVERITY_LABEL[a.severity]}
                        </Badge>
                        <span className="text-sm font-medium">{a.title}</span>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Por que isso apareceu aqui?">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{a.why_here}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.action_label} · {a.customer_name ?? '—'}
                      </p>
                    </div>
                    {href ? (
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0">
                        <Link to={href}>
                          Abrir <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled className="h-7 px-2 text-xs shrink-0">Abrir</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
