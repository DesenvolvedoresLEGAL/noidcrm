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
  Activity,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { Opportunity } from '@/services/crm/types';
import { formatDateBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { formatCurrencyValue } from '@/lib/i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadGradeBadge } from '@/components/scoring/LeadGradeBadge';
import { NRHSBadge } from '@/components/nrhs/NRHSBadge';
import { NRHSTier } from '@/services/crm/nrhs-calculator';

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
    // NRHS fields
    nrhs_score?: number | null;
    nrhs_tier?: NRHSTier | null;
    nrhs_issues_count?: number | null;
    nrhs_blockers?: string[] | null;
    account?: {
      lead_score?: number | null;
      lead_grade?: string | null;
      fit_score?: number | null;
      intent_score?: number | null;
    };
  };
  onClick: () => void;
  href?: string;
}

export function OpportunityCard({ opportunity, onClick, href }: OpportunityCardProps) {
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
    const configs: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
      cold: { color: 'text-blue-500', bgColor: 'bg-blue-500', borderColor: 'border-l-blue-500', label: 'Frio' },
      warm: { color: 'text-yellow-500', bgColor: 'bg-yellow-500', borderColor: 'border-l-yellow-500', label: 'Morno' },
      hot: { color: 'text-orange-500', bgColor: 'bg-orange-500', borderColor: 'border-l-orange-500', label: 'Quente' },
      burning: { color: 'text-red-500', bgColor: 'bg-red-500', borderColor: 'border-l-red-500', label: 'Urgente' },
    };
    return configs[temperatura || 'warm'] || configs.warm;
  };

  const tempConfig = getTemperatureConfig(opportunity.temperatura || opportunity.temperature);


  const getActivityStatusConfig = (count: number) => {
    if (count === 0) {
      return { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-950', icon: AlertCircle, label: 'Sem ativ.' };
    }
    return { color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950', icon: CheckCircle2, label: `${count} ativ.` };
  };

  const getStagnationConfig = (days: number, alertDays: number) => {
    if (days <= alertDays * 0.5) {
      return { color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950' };
    }
    if (days <= alertDays) {
      return { color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-950' };
    }
    return { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-950' };
  };

  const getDealHealthConfig = () => {
    const engagement = opportunity.engagement_score || 50;
    const velocity = opportunity.velocity_score || 50;
    const risk = opportunity.risk_score || 50;
    const healthScore = Math.round((engagement * 0.35) + (velocity * 0.25) + ((100 - risk) * 0.40));
    
    if (healthScore >= 65) {
      return { color: 'text-emerald-600', icon: Heart, label: 'Saudável', score: healthScore };
    }
    if (healthScore >= 40) {
      return { color: 'text-yellow-600', icon: Activity, label: 'Em risco', score: healthScore };
    }
    return { color: 'text-red-600', icon: HeartCrack, label: 'Crítico', score: healthScore };
  };

  const getOpportunityScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const healthConfig = getDealHealthConfig();
  const HealthIcon = healthConfig.icon;
  const activityConfig = getActivityStatusConfig(pendingActivities);
  const stagnationConfig = getStagnationConfig(daysInStage, stagnationDays);
  const ActivityIcon = activityConfig.icon;

  const truncateEmail = (email?: string) => {
    if (!email) return null;
    if (email.length <= 18) return email;
    const [local, domain] = email.split('@');
    if (!domain) return email.slice(0, 15) + '...';
    const truncatedLocal = local.length > 8 ? local.slice(0, 6) + '..' : local;
    return `${truncatedLocal}@${domain}`;
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Right-click - deixa o menu de contexto nativo aparecer
    if (e.button === 2) {
      return;
    }
    // Não navegar se estava arrastando
    if (isDragging) {
      e.preventDefault();
      return;
    }
    // Ctrl+Click, Cmd+Click ou middle-click permite abrir em nova aba nativamente
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      return; // Deixa o comportamento nativo do link
    }
    // Click normal - usar onClick para navegação SPA
    e.preventDefault();
    onClick();
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(isDragging && "scale-105 rotate-1")}
    >
      <a 
        href={href || '#'} 
        onClick={handleClick}
        className="block"
        draggable={false}
      >
        <Card
          className={cn(
            "p-3 cursor-grab active:cursor-grabbing transition-all duration-200",
            "hover:shadow-lg hover:border-primary/40 group border-l-4",
            tempConfig.borderColor,
            isDragging && "shadow-2xl ring-2 ring-primary/50",
            !isDragging && isSorting && "animate-pulse",
            // NRHS visual indicator for critical hygiene
            opportunity.nrhs_score !== null && opportunity.nrhs_score !== undefined && opportunity.nrhs_score < 60 && "ring-1 ring-orange-400/50"
          )}
        >
        <div className="space-y-2.5">
          
          {/* SECTION 1: HEADER - Avatar + Título Protagonista */}
          <div className="flex items-start gap-2">
            {opportunity.owner_name && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 flex-shrink-0 border border-border">
                      <AvatarImage src={opportunity.owner_avatar_url || undefined} alt={opportunity.owner_name} />
                      <AvatarFallback className="text-[9px] bg-primary text-primary-foreground font-medium">
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
            <h4 className="font-semibold text-sm text-foreground leading-tight flex-1 min-w-0">
              {opportunity.title || opportunity.account_name || 'Sem título'}
            </h4>
          </div>

          {/* SECTION 2: CONTEXTO - Empresa + Localização */}
          {opportunity.account_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium truncate">{opportunity.account_name}</span>
              {opportunity.account_cidade && (
                <span className="text-muted-foreground/70 truncate">
                  • {opportunity.account_cidade}{opportunity.account_uf ? `/${opportunity.account_uf}` : ''}
                </span>
              )}
            </div>
          )}

          {/* SECTION 3: CONTATO - Nome + Email/Phone inline */}
          {(opportunity.contact_name || opportunity.contact_email || opportunity.contact_phone) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              {opportunity.contact_name && (
                <span className="font-medium truncate max-w-[80px]">{opportunity.contact_name}</span>
              )}
              {opportunity.contact_cargo && (
                <span className="text-muted-foreground/70 truncate">• {opportunity.contact_cargo}</span>
              )}
              {opportunity.contact_email && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-0.5 ml-auto">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[90px]">{truncateEmail(opportunity.contact_email)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="text-xs">{opportunity.contact_email}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {/* SECTION 4: VALORES - Avulso + MRR + Data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {valorAvulso > 0 && (
                <div className="flex items-center gap-0.5">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">{formatCurrencyValue(valorAvulso)}</span>
                </div>
              )}
              {valorMRR > 0 && (
                <div className="flex items-center gap-0.5">
                  <Repeat className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-500">{formatCurrencyValue(valorMRR)}/mês</span>
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

          {/* SECTION 5: ALERTAS - Chips de Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Temperatura */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                    tempConfig.color, "bg-opacity-10",
                    tempConfig.bgColor.replace('bg-', 'bg-') + '/10'
                  )}>
                    <Flame className="h-3 w-3" />
                    <span>{tempConfig.label}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">Temperatura: {tempConfig.label}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Atividades */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                    activityConfig.bgColor, activityConfig.color
                  )}>
                    <ActivityIcon className="h-3 w-3" />
                    <span>{activityConfig.label}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">
                    {pendingActivities === 0 
                      ? 'Nenhuma atividade pendente' 
                      : `${pendingActivities} atividade(s) pendente(s)`}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dias no estágio */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                    stagnationConfig.bgColor, stagnationConfig.color
                  )}>
                    <Clock className="h-3 w-3" />
                    <span>{daysInStage}d</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="text-xs">{daysInStage} dia(s) nesta etapa</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Produto */}
            {opportunity.produto && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
                {opportunity.produto}
              </Badge>
            )}
          </div>

          {/* SECTION 6: RODAPÉ - Scores Consolidados */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              {/* Scores à esquerda */}
              <div className="flex items-center gap-2">
                {/* Opportunity Score */}
                {opportunity.opportunity_score !== undefined && opportunity.opportunity_score !== null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white",
                          getOpportunityScoreColor(opportunity.opportunity_score)
                        )}>
                          {opportunity.opportunity_score}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">Opportunity Score: {opportunity.opportunity_score}</p>
                          <p>Engajamento: {opportunity.engagement_score || 0}%</p>
                          <p>Velocidade: {opportunity.velocity_score || 0}%</p>
                          <p>Risco: {opportunity.risk_score || 0}%</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* NRHS Badge */}
                {opportunity.nrhs_score !== undefined && opportunity.nrhs_score !== null && (
                  <NRHSBadge
                    score={opportunity.nrhs_score}
                    tier={opportunity.nrhs_tier || null}
                    issuesCount={opportunity.nrhs_issues_count || 0}
                    blockers={opportunity.nrhs_blockers || []}
                    size="sm"
                  />
                )}

                {/* Lead Grade */}
                {opportunity.account?.lead_grade && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <LeadGradeBadge 
                            grade={opportunity.account.lead_grade} 
                            size="sm" 
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">Lead Grade: {opportunity.account.lead_grade}</p>
                          <p>FIT: {opportunity.account.fit_score || 0}</p>
                          <p>INTENT: {opportunity.account.intent_score || 0}</p>
                          <p>Score Total: {opportunity.account.lead_score || 0}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Métricas à direita */}
              <div className="flex items-center gap-2 text-[10px]">
                {/* Probabilidade */}
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>{prob}%</span>
                </div>

                {/* AI Win Probability */}
                {opportunity.win_probability_ai !== undefined && opportunity.win_probability_ai !== null && (
                  <div className="flex items-center gap-0.5 text-purple-500">
                    <Sparkles className="h-3 w-3" />
                    <span>{opportunity.win_probability_ai}%</span>
                  </div>
                )}

                {/* Health */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn("flex items-center gap-0.5", healthConfig.color)}>
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
              </div>
            </div>
          </div>

        </div>
      </Card>
      </a>
    </div>
  );
}
