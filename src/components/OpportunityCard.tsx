import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, DollarSign, Flame, Building2 } from 'lucide-react';
import { Opportunity } from '@/services/crm/types';
import { formatDateBR } from '@/lib/dateUtils';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { cn } from '@/lib/utils';

interface OpportunityCardProps {
  opportunity: Opportunity & {
    title?: string;
    origem?: string;
    fonte?: string;
    temperatura?: string;
    account_name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_linkedin?: string;
    owner_name?: string;
    owner_avatar_url?: string;
    opportunity_score?: number | null;
    engagement_score?: number | null;
    velocity_score?: number | null;
    risk_score?: number | null;
    win_probability_ai?: number | null;
    account?: {
      lead_score?: number | null;
      lead_grade?: string | null;
      fit_score?: number | null;
      intent_score?: number | null;
    };
  };
  onClick: () => void;
}

export function OpportunityCard({ opportunity, onClick }: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const valorPS = opportunity.valor_previsto || 0;
  const prob = Math.min(opportunity.prob || 0, 100);

  const getTemperatureIcon = (temperatura?: string) => {
    if (!temperatura) return null;
    const colors: Record<string, string> = {
      cold: 'text-blue-500',
      warm: 'text-yellow-500',
      hot: 'text-orange-500',
      burning: 'text-red-500',
    };
    return colors[temperatura] ? (
      <Flame className={cn("h-3.5 w-3.5", colors[temperatura])} />
    ) : null;
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "p-3 cursor-grab active:cursor-grabbing transition-all duration-200",
          "hover:shadow-md hover:border-primary/30 group"
        )}
        onClick={onClick}
      >
        <div className="space-y-2">
          {/* Row 1: Title + Badges + Avatar */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                {opportunity.title || opportunity.account_name || 'Sem título'}
              </h4>
              {opportunity.account_name && opportunity.title !== opportunity.account_name && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{opportunity.account_name}</span>
                </div>
              )}
            </div>
            
            {/* Compact badges row */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {getTemperatureIcon(opportunity.temperatura || opportunity.temperature)}
              
              {opportunity.opportunity_score !== undefined && opportunity.opportunity_score !== null && (
                <OpportunityScoreCard
                  opportunityScore={opportunity.opportunity_score}
                  engagementScore={opportunity.engagement_score}
                  velocityScore={opportunity.velocity_score}
                  riskScore={opportunity.risk_score}
                  winProbabilityAi={opportunity.win_probability_ai}
                  variant="badge"
                />
              )}
              
              {opportunity.account?.lead_grade && (
                <LeadScoreCard
                  leadGrade={opportunity.account.lead_grade}
                  leadScore={opportunity.account.lead_score}
                  fitScore={opportunity.account.fit_score}
                  intentScore={opportunity.account.intent_score}
                  variant="inline"
                />
              )}
              
              {opportunity.owner_name && (
                <Avatar className="h-6 w-6 border border-background shadow-sm" title={opportunity.owner_name}>
                  <AvatarImage src={opportunity.owner_avatar_url || undefined} alt={opportunity.owner_name} />
                  <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                    {opportunity.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>

          {/* Row 2: Value + Date */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-primary font-bold">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{formatCurrency(valorPS)}</span>
            </div>
            {opportunity.close_date_prevista && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDateBR(opportunity.close_date_prevista)}</span>
              </div>
            )}
          </div>

          {/* Row 3: Progress bar */}
          <div className="relative">
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div
                className="bg-primary h-1 rounded-full transition-all"
                style={{ width: `${prob}%` }}
              />
            </div>
            {opportunity.win_probability_ai !== undefined && opportunity.win_probability_ai !== null && (
              <div
                className="absolute top-0 h-1 w-0.5 bg-accent"
                style={{ left: `${opportunity.win_probability_ai}%` }}
                title={`AI: ${opportunity.win_probability_ai}%`}
              />
            )}
          </div>

          {/* Optional: Product badge */}
          {opportunity.produto && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {opportunity.produto}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
