import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar, 
  DollarSign, 
  Flame, 
  Building2, 
  User, 
  Mail, 
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Heart,
  HeartCrack,
  Activity
} from 'lucide-react';
import { Opportunity } from '@/services/crm/types';
import { formatDateBR } from '@/lib/dateUtils';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OpportunityCardProps {
  opportunity: Opportunity & {
    title?: string;
    origem?: string;
    fonte?: string;
    temperatura?: string;
    account_name?: string;
    account_cidade?: string;
    account_uf?: string;
    account_origem?: string;
    contact_name?: string;
    contact_cargo?: string;
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
    pending_activities_count?: number;
    days_in_stage?: number;
    stagnation_alert_days?: number;
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
    isSorting,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease, opacity 200ms ease, box-shadow 200ms ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const valorAvulso = opportunity.valor_previsto || 0;
  const valorMRR = (opportunity as any).mrr || (opportunity as any).valor_mrr || 0;
  const prob = Math.min(opportunity.prob || 0, 100);
  const pendingActivities = opportunity.pending_activities_count || 0;
  const daysInStage = opportunity.days_in_stage || 0;
  const stagnationDays = opportunity.stagnation_alert_days || 7;

  const getTemperatureConfig = (temperatura?: string) => {
    const configs: Record<string, { color: string; bgColor: string; label: string }> = {
      cold: { color: 'text-blue-500', bgColor: 'bg-blue-500', label: 'Frio' },
      warm: { color: 'text-yellow-500', bgColor: 'bg-yellow-500', label: 'Morno' },
      hot: { color: 'text-orange-500', bgColor: 'bg-orange-500', label: 'Quente' },
      burning: { color: 'text-red-500', bgColor: 'bg-red-500', label: 'Urgente' },
    };
    return configs[temperatura || 'warm'] || configs.warm;
  };

  const tempConfig = getTemperatureConfig(opportunity.temperatura || opportunity.temperature);

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

  const getActivityStatusConfig = (count: number) => {
    if (count === 0) {
      return { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-950', icon: AlertCircle, label: 'Nenhuma' };
    }
    return { color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950', icon: CheckCircle2, label: `${count}` };
  };

  const getStagnationConfig = (days: number, alertDays: number) => {
    if (days <= alertDays * 0.5) {
      return { color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950', label: 'OK' };
    }
    if (days <= alertDays) {
      return { color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-950', label: 'Atenção' };
    }
    return { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-950', label: 'Parado' };
  };

  // Deal Health Chip configuration
  const getDealHealthConfig = () => {
    const engagement = opportunity.engagement_score || 50;
    const velocity = opportunity.velocity_score || 50;
    const risk = opportunity.risk_score || 50;
    
    // Calculate health score: higher engagement/velocity = good, higher risk = bad
    const healthScore = Math.round((engagement * 0.35) + (velocity * 0.25) + ((100 - risk) * 0.40));
    
    if (healthScore >= 65) {
      return { 
        color: 'text-emerald-600', 
        bgColor: 'bg-emerald-100 dark:bg-emerald-950', 
        icon: Heart, 
        label: 'Saudável',
        score: healthScore
      };
    }
    if (healthScore >= 40) {
      return { 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-100 dark:bg-yellow-950', 
        icon: Activity, 
        label: 'Em risco',
        score: healthScore
      };
    }
    return { 
      color: 'text-red-600', 
      bgColor: 'bg-red-100 dark:bg-red-950', 
      icon: HeartCrack, 
      label: 'Crítico',
      score: healthScore
    };
  };

  const healthConfig = getDealHealthConfig();
  const HealthIcon = healthConfig.icon;

  const activityConfig = getActivityStatusConfig(pendingActivities);
  const stagnationConfig = getStagnationConfig(daysInStage, stagnationDays);
  const ActivityIcon = activityConfig.icon;

  const truncateEmail = (email?: string) => {
    if (!email) return null;
    if (email.length <= 20) return email;
    const [local, domain] = email.split('@');
    if (!domain) return email.slice(0, 17) + '...';
    const truncatedLocal = local.length > 10 ? local.slice(0, 8) + '...' : local;
    return `${truncatedLocal}@${domain}`;
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        isDragging && "scale-105 rotate-1"
      )}
    >
      <Card
        className={cn(
          "p-4 cursor-grab active:cursor-grabbing transition-all duration-200",
          "hover:shadow-lg hover:border-primary/40 group border-l-4",
          tempConfig.bgColor.replace('bg-', 'border-l-'),
          isDragging && "shadow-2xl ring-2 ring-primary/50",
          !isDragging && isSorting && "animate-pulse"
        )}
        onClick={onClick}
      >
        <div className="space-y-3">
          {/* Row 1: Title + Scores + Avatar */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
                {opportunity.title || opportunity.account_name || 'Sem título'}
              </h4>
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7 border-2 border-background shadow-sm">
                        <AvatarImage src={opportunity.owner_avatar_url || undefined} alt={opportunity.owner_name} />
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-medium">
                          {opportunity.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="text-xs">{opportunity.owner_name}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Row 2: Company + Origin + Temperature */}
          <div className="flex items-center gap-2 text-xs">
            {opportunity.account_name && (
              <div className="flex items-center gap-1 text-muted-foreground flex-1 min-w-0">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate font-medium">{opportunity.account_name}</span>
                {opportunity.account_cidade && (
                  <span className="text-muted-foreground/60 truncate">
                    • {opportunity.account_cidade}{opportunity.account_uf ? `/${opportunity.account_uf}` : ''}
                  </span>
                )}
              </div>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("flex items-center gap-0.5", tempConfig.color)}>
                    <Flame className="h-4 w-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">{tempConfig.label}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Row 3: Contact Info */}
          {(opportunity.contact_name || opportunity.contact_email || opportunity.contact_phone) && (
            <div className="bg-muted/50 rounded-md p-2 space-y-1">
              {opportunity.contact_name && (
                <div className="flex items-center gap-1.5 text-xs">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{opportunity.contact_name}</span>
                  {opportunity.contact_cargo && (
                    <span className="text-muted-foreground truncate">• {opportunity.contact_cargo}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {opportunity.contact_email && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 min-w-0">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{truncateEmail(opportunity.contact_email)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span className="text-xs">{opportunity.contact_email}</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {opportunity.contact_phone && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Phone className="h-3 w-3" />
                    <span>{formatPhone(opportunity.contact_phone)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4: Values + Close Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {valorAvulso > 0 && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">{formatCurrency(valorAvulso)}</span>
                </div>
              )}
              {valorMRR > 0 && (
                <div className="flex items-center gap-1">
                  <Repeat className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-500">{formatCurrency(valorMRR)}/mês</span>
                </div>
              )}
            </div>
            {opportunity.close_date_prevista && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDateBR(opportunity.close_date_prevista)}</span>
              </div>
            )}
          </div>

          {/* Row 5: Health Chip + Alerts - Activities + Time in Stage */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Deal Health Chip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold",
                    healthConfig.bgColor, healthConfig.color
                  )}>
                    <HealthIcon className="h-3 w-3" />
                    <span>{healthConfig.score}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">{healthConfig.label}</p>
                    <p>Engajamento: {opportunity.engagement_score || 50}%</p>
                    <p>Velocidade: {opportunity.velocity_score || 50}%</p>
                    <p>Risco: {opportunity.risk_score || 50}%</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                    activityConfig.bgColor, activityConfig.color
                  )}>
                    <ActivityIcon className="h-3 w-3" />
                    <span>{pendingActivities === 0 ? 'Sem ativ.' : `${pendingActivities} ativ.`}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">
                    {pendingActivities === 0 
                      ? 'Nenhuma atividade pendente - Ação necessária!' 
                      : `${pendingActivities} atividade(s) pendente(s)`}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                    stagnationConfig.bgColor, stagnationConfig.color
                  )}>
                    <Clock className="h-3 w-3" />
                    <span>{daysInStage}d</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">
                    {daysInStage} dia(s) nesta etapa • Alerta: {stagnationDays} dias
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {opportunity.produto && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
                {opportunity.produto}
              </Badge>
            )}
          </div>

          {/* Row 6: Progress Bar by Temperature */}
          <div className="relative">
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={cn("h-1.5 rounded-full transition-all", tempConfig.bgColor)}
                style={{ width: `${prob}%` }}
              />
            </div>
            {opportunity.win_probability_ai !== undefined && opportunity.win_probability_ai !== null && (
              <div
                className="absolute top-0 h-1.5 w-0.5 bg-purple-500"
                style={{ left: `${Math.min(opportunity.win_probability_ai, 100)}%` }}
                title={`AI: ${opportunity.win_probability_ai}%`}
              />
            )}
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Prob: {prob}%</span>
              {opportunity.win_probability_ai !== undefined && opportunity.win_probability_ai !== null && (
                <span className="text-purple-500">AI: {opportunity.win_probability_ai}%</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
