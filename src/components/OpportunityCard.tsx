import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, DollarSign, Mail, Phone, Linkedin, Clock, Flame, Building2 } from 'lucide-react';
import { Opportunity } from '@/services/crm/types';
import { formatDateBR } from '@/lib/dateUtils';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';

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
    // Owner fields
    owner_name?: string;
    owner_avatar_url?: string;
    // Scoring fields
    opportunity_score?: number | null;
    engagement_score?: number | null;
    velocity_score?: number | null;
    risk_score?: number | null;
    win_probability_ai?: number | null;
    // Account scoring fields
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
  const mrr = opportunity.meta?.mrr || 0;
  const prob = Math.min(opportunity.prob || 0, 100);

  // Temperatura badge variants
  const getTemperatureBadge = (temperatura?: string) => {
    if (!temperatura) return null;
    
    const variants: Record<string, { label: string; className: string }> = {
      cold: { label: 'Frio', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      warm: { label: 'Morno', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      hot: { label: 'Quente', className: 'bg-orange-100 text-orange-700 border-orange-200' },
      burning: { label: 'Ardente', className: 'bg-red-100 text-red-700 border-red-200' },
    };

    const temp = variants[temperatura];
    if (!temp) return null;

    return (
      <Badge variant="outline" className={`text-xs ${temp.className}`}>
        <Flame className="h-3 w-3 mr-1" />
        {temp.label}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return formatDateBR(dateString);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-all duration-200 hover:scale-[1.02] animate-fade-in"
        onClick={onClick}
      >
        <div className="space-y-3">
          {/* Header: Title + Badges + Avatar na mesma linha */}
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground line-clamp-1 flex-1 min-w-0">
              {opportunity.title || opportunity.account_name || 'Sem título'}
            </h4>
            
            {/* Badges inline */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Opportunity Score Badge */}
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
              
              {/* Lead Score Badge */}
              {opportunity.account?.lead_grade && (
                <LeadScoreCard
                  leadGrade={opportunity.account.lead_grade}
                  leadScore={opportunity.account.lead_score}
                  fitScore={opportunity.account.fit_score}
                  intentScore={opportunity.account.intent_score}
                  variant="inline"
                />
              )}
              
              {/* Seller Avatar */}
              {opportunity.owner_name && (
                <Avatar className="h-7 w-7 border border-background shadow-sm" title={opportunity.owner_name}>
                  <AvatarImage src={opportunity.owner_avatar_url || undefined} alt={opportunity.owner_name} />
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                    {opportunity.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
          
          {/* Account Name */}
          {opportunity.account_name && opportunity.title !== opportunity.account_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{opportunity.account_name}</span>
            </div>
          )}
          
          {/* Badges de Temperatura e Origem */}
          <div className="flex flex-wrap gap-1">
            {opportunity.produto && (
              <Badge variant="secondary" className="text-xs">
                {opportunity.produto}
              </Badge>
            )}
            {getTemperatureBadge(opportunity.temperatura || opportunity.temperature)}
            {opportunity.origem && (
              <Badge variant="outline" className="text-xs">
                {opportunity.origem}
              </Badge>
            )}
            {opportunity.fonte && (
              <Badge variant="outline" className="text-xs">
                {opportunity.fonte}
              </Badge>
            )}
          </div>

          {/* Contato */}
          {opportunity.contact_name && (
            <div className="text-xs">
              <span className="font-medium text-foreground">{opportunity.contact_name}</span>
            </div>
          )}

          {/* Informações de contato */}
          {(opportunity.contact_email || opportunity.contact_phone || opportunity.contact_linkedin) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {opportunity.contact_email && (
                <div className="flex items-center gap-1" title={opportunity.contact_email}>
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">{opportunity.contact_email}</span>
                </div>
              )}
              {opportunity.contact_phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span>{opportunity.contact_phone}</span>
                </div>
              )}
              {opportunity.contact_linkedin && (
                <a 
                  href={opportunity.contact_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <Linkedin className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Valores */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-primary font-semibold">
              <DollarSign className="h-4 w-4" />
              <span>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(valorPS)}
              </span>
            </div>
            {mrr > 0 && (
              <div className="text-xs text-muted-foreground">
                MRR: {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(mrr)}
              </div>
            )}
          </div>

          {/* Datas importantes */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {opportunity.created_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>Cadastro: {formatDate(opportunity.created_at)}</span>
              </div>
            )}
            {opportunity.close_date_prevista && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>Previsão: {formatDate(opportunity.close_date_prevista)}</span>
              </div>
            )}
            {opportunity.last_contact_date && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>Último contato: {formatDate(opportunity.last_contact_date)}</span>
              </div>
            )}
          </div>

          {/* Score Bar or Probability */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{prob.toFixed(0)}% probabilidade</span>
              {opportunity.win_probability_ai !== undefined && opportunity.win_probability_ai !== null && (
                <span className="text-primary font-medium">
                  AI: {opportunity.win_probability_ai}%
                </span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${prob}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
