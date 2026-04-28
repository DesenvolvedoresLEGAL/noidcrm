import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, Info } from 'lucide-react';
import { buildCloserCtaHref, severityBadgeVariant, SEVERITY_LABEL } from './closerCta';
import type { CloserListItem } from '@/types/dashboard/closer';

function formatBRL(v?: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

interface Props {
  item: CloserListItem;
  showValue?: boolean;
}

const CTA_LABEL = {
  activity: 'Ver atividade',
  proposal: 'Ver proposta',
  opportunity: 'Ver oportunidade',
} as const;

export function CloserListItemRow({ item, showValue = true }: Props) {
  const href = buildCloserCtaHref(item.kind, item.id, item.opportunity_id);
  const ctaLabel = CTA_LABEL[item.kind];
  const valueText = showValue ? formatBRL(item.value) : null;

  return (
    <li className="py-2 flex items-start justify-between gap-3 border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={severityBadgeVariant(item.severity)} className="text-xs">
            {SEVERITY_LABEL[item.severity]}
          </Badge>
          <span className="text-sm font-medium truncate">
            {item.customer_name ?? item.title ?? '—'}
          </span>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Por que isso apareceu aqui?">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{item.why_here}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {(item.stage_name || item.risk_reason || item.title) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.risk_reason ?? item.stage_name ?? item.title}
          </p>
        )}
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {valueText && <span className="text-sm font-semibold">{valueText}</span>}
        {href ? (
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Link to={href}>
              {ctaLabel} <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        ) : (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" disabled className="h-7 px-2 text-xs">
                  {ctaLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Rota não disponível para este item.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </li>
  );
}
