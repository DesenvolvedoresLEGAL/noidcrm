import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  CalendarPlus, CheckCircle, Trash2, XCircle, Mail, Eye, 
  FileText, Send, PartyPopper, Paperclip, Zap, GitBranch, 
  Edit3, Plus, Phone, Users, MessageSquare, Calendar, 
  Clock, Bot, StickyNote, ArrowRightLeft, AlertCircle, 
  Star, Trophy, User, FileCheck, TrendingUp, Activity, 
  Brain, BellRing, Gauge
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { EnhancedTimelineEvent, TimelineEventType } from '@/services/crm/enhanced-timeline';
import { getEventActionLabel, ACTIVITY_TYPE_LABELS } from '@/services/crm/enhanced-timeline';

interface TimelineEventCardProps {
  event: EnhancedTimelineEvent;
}

interface IconConfig {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

function getEventIcon(type: TimelineEventType, activityType: string, metadata?: Record<string, any>): IconConfig {
  const iconClass = "h-4 w-4";
  
  switch (type) {
    case 'activity':
      if (metadata?.deleted_at || metadata?.status === 'deleted') {
        return { icon: <Trash2 className={iconClass} />, bgColor: 'bg-destructive/20', textColor: 'text-destructive' };
      }
      if (metadata?.status === 'completed' || metadata?.completed_at) {
        return { icon: <CheckCircle className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
      }
      if (metadata?.status === 'no_show') {
        return { icon: <XCircle className={iconClass} />, bgColor: 'bg-orange-500/20', textColor: 'text-orange-600' };
      }
      // By activity type
      switch (activityType) {
        case 'call': return { icon: <Phone className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
        case 'meeting': return { icon: <Users className={iconClass} />, bgColor: 'bg-purple-500/20', textColor: 'text-purple-600' };
        case 'email': return { icon: <Mail className={iconClass} />, bgColor: 'bg-sky-500/20', textColor: 'text-sky-600' };
        case 'whatsapp': return { icon: <MessageSquare className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
        case 'demo': return { icon: <Calendar className={iconClass} />, bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-600' };
        default: return { icon: <CalendarPlus className={iconClass} />, bgColor: 'bg-primary/20', textColor: 'text-primary' };
      }
    
    case 'note':
      return { icon: <StickyNote className={iconClass} />, bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-600' };
    
    case 'email':
      if (metadata?.opened_at) {
        return { icon: <Eye className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
      }
      return { icon: <Mail className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
    
    case 'audit':
      switch (activityType) {
        case 'opportunity_created': return { icon: <Plus className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
        case 'stage_moved': return { icon: <GitBranch className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
        case 'field_updated': return { icon: <Edit3 className={iconClass} />, bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-600' };
        case 'status_changed': return { icon: <CheckCircle className={iconClass} />, bgColor: 'bg-primary/20', textColor: 'text-primary' };
        case 'opportunity_deleted': return { icon: <Trash2 className={iconClass} />, bgColor: 'bg-destructive/20', textColor: 'text-destructive' };
        case 'proposal_accepted': return { icon: <PartyPopper className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
        case 'handoff_received': return { icon: <ArrowRightLeft className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
        default: return { icon: <Clock className={iconClass} />, bgColor: 'bg-muted', textColor: 'text-muted-foreground' };
      }
    
    case 'proposal':
      switch (activityType) {
        case 'accepted': return { icon: <PartyPopper className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
        case 'viewed': return { icon: <Eye className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
        case 'sent': return { icon: <Send className={iconClass} />, bgColor: 'bg-purple-500/20', textColor: 'text-purple-600' };
        default: return { icon: <FileText className={iconClass} />, bgColor: 'bg-gray-500/20', textColor: 'text-gray-600' };
      }
    
    case 'file':
      return { icon: <Paperclip className={iconClass} />, bgColor: 'bg-gray-500/20', textColor: 'text-gray-600' };
    
    case 'automation':
      if (metadata?.status === 'failed') {
        return { icon: <AlertCircle className={iconClass} />, bgColor: 'bg-destructive/20', textColor: 'text-destructive' };
      }
      return { icon: <Zap className={iconClass} />, bgColor: 'bg-purple-500/20', textColor: 'text-purple-600' };
    
    case 'score':
      // Differentiate score icons by field type
      if (metadata?.field === 'opportunity_score') {
        return { icon: <Gauge className={iconClass} />, bgColor: 'bg-blue-500/20', textColor: 'text-blue-600' };
      }
      if (metadata?.field?.startsWith('nrhs')) {
        return { icon: <Activity className={iconClass} />, bgColor: 'bg-purple-500/20', textColor: 'text-purple-600' };
      }
      if (metadata?.field === 'win_probability_ai') {
        return { icon: <Brain className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
      }
      return { icon: <TrendingUp className={iconClass} />, bgColor: 'bg-cyan-500/20', textColor: 'text-cyan-600' };
    
    case 'vibe':
      switch (activityType) {
        case 'vibe_alert_acknowledged': return { icon: <CheckCircle className={iconClass} />, bgColor: 'bg-green-500/20', textColor: 'text-green-600' };
        case 'vibe_alert_dismissed': return { icon: <XCircle className={iconClass} />, bgColor: 'bg-gray-500/20', textColor: 'text-gray-600' };
        default: return { icon: <BellRing className={iconClass} />, bgColor: 'bg-orange-500/20', textColor: 'text-orange-600' };
      }
    
    case 'ai':
      return { icon: <Brain className={iconClass} />, bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-600' };
    
    case 'stakeholder':
      return { icon: <Star className={iconClass} />, bgColor: 'bg-amber-500/20', textColor: 'text-amber-600' };
    
    case 'participant':
      return { icon: <Users className={iconClass} />, bgColor: 'bg-teal-500/20', textColor: 'text-teal-600' };
    
    default:
      return { icon: <Clock className={iconClass} />, bgColor: 'bg-muted', textColor: 'text-muted-foreground' };
  }
}

function getBadgeVariant(type: TimelineEventType, activityType: string, metadata?: Record<string, any>): "default" | "secondary" | "destructive" | "outline" {
  if (type === 'activity' && (metadata?.deleted_at || metadata?.status === 'deleted')) {
    return 'destructive';
  }
  if (type === 'audit' && activityType === 'opportunity_deleted') {
    return 'destructive';
  }
  if (type === 'proposal' && activityType === 'accepted') {
    return 'default';
  }
  if (type === 'automation' && metadata?.status === 'failed') {
    return 'destructive';
  }
  return 'secondary';
}

function formatTimestamp(timestamp: string) {
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
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getDifferentiatorLabel(diff: string): string {
  const labels: Record<string, string> = {
    'Preço': 'Preço',
    'Produto': 'Produto',
    'Atendimento': 'Atendimento',
    'Marca': 'Marca',
    'Relacionamento': 'Relacionamento',
    'Timing': 'Timing',
  };
  return labels[diff] || diff;
}

export function TimelineEventCard({ event }: TimelineEventCardProps) {
  const iconConfig = getEventIcon(event.type, event.activity_type, event.metadata);
  const actionLabel = getEventActionLabel(event.type, event.activity_type, event.metadata);
  const timestamp = formatTimestamp(event.timestamp);
  const badgeVariant = getBadgeVariant(event.type, event.activity_type, event.metadata);

  // Build key-value fields based on event type
  const fields: { label: string; value: string | React.ReactNode }[] = [];

  switch (event.type) {
    case 'activity':
      if (event.title) {
        fields.push({ label: 'Título', value: event.title });
      }
      if (event.activity_type && ACTIVITY_TYPE_LABELS[event.activity_type]) {
        fields.push({ label: 'Tipo', value: ACTIVITY_TYPE_LABELS[event.activity_type] });
      }
      if (event.metadata?.description) {
        fields.push({ label: 'Descrição', value: event.metadata.description });
      }
      if (event.metadata?.scheduled_date) {
        fields.push({ 
          label: 'Agendado para', 
          value: new Date(event.metadata.scheduled_date).toLocaleString('pt-BR') 
        });
      }
      if (event.metadata?.duration_minutes) {
        fields.push({ label: 'Duração', value: `${event.metadata.duration_minutes} min` });
      }
      if (event.metadata?.status) {
        const statusLabels: Record<string, string> = {
          pending: 'Pendente',
          completed: 'Concluída',
          cancelled: 'Cancelada',
          no_show: 'No-show',
        };
        fields.push({ label: 'Status', value: statusLabels[event.metadata.status] || event.metadata.status });
      }
      if (event.metadata?.is_automated) {
        fields.push({ label: 'Origem', value: <Badge variant="outline" className="text-xs"><Bot className="h-3 w-3 mr-1" />Automática</Badge> });
      }
      break;

    case 'note':
      if (event.metadata?.content) {
        fields.push({ label: 'Conteúdo', value: event.metadata.content });
      }
      break;

    case 'email':
      if (event.title) {
        fields.push({ label: 'Assunto', value: event.title });
      }
      if (event.metadata?.to_emails) {
        const emails = Array.isArray(event.metadata.to_emails) 
          ? event.metadata.to_emails.join(', ') 
          : event.metadata.to_emails;
        fields.push({ label: 'Para', value: emails });
      }
      if (event.metadata?.opened_at) {
        fields.push({ 
          label: 'Aberto em', 
          value: new Date(event.metadata.opened_at).toLocaleString('pt-BR') 
        });
      }
      break;

    case 'audit':
      if (event.metadata?.field_name) {
        fields.push({ label: 'Campo', value: event.metadata.field_label || event.metadata.field_name });
      }
      if (event.metadata?.old_value_label !== undefined || event.metadata?.new_value_label !== undefined) {
        const oldVal = event.metadata.old_value_label || '-';
        const newVal = event.metadata.new_value_label || '-';
        fields.push({ 
          label: 'Alteração', 
          value: <span className="font-medium">{oldVal} <span className="text-muted-foreground">→</span> {newVal}</span>
        });
      }
      // Extra for proposal_accepted
      if (event.activity_type === 'proposal_accepted') {
        const meta = event.metadata?.metadata || {};
        if (meta.proposal_title) {
          fields.push({ label: 'Proposta', value: meta.proposal_title });
        }
        if (meta.proposal_value) {
          fields.push({ label: 'Valor', value: formatCurrency(meta.proposal_value) });
        }
        if (meta.acceptor_name) {
          fields.push({ label: 'Aprovado por', value: meta.acceptor_name });
        }
        if (meta.acceptor_position) {
          fields.push({ label: 'Cargo', value: meta.acceptor_position });
        }
        if (meta.acceptor_document) {
          const doc = String(meta.acceptor_document);
          const masked = doc.length > 6 ? doc.slice(0, 3) + '***' + doc.slice(-3) : '***';
          fields.push({ label: 'Documento', value: masked });
        }
        if (meta.accepted_at) {
          fields.push({ label: 'Aceita em', value: format(new Date(meta.accepted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) });
        }
        if (meta.acceptance_proof_url) {
          fields.push({ 
            label: 'Comprovante', 
            value: <a href={meta.acceptance_proof_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Ver comprovante</a>
          });
        }
      }
      // Extra for handoff
      if (event.activity_type === 'handoff_received') {
        if (event.metadata?.metadata?.source_pipeline_name) {
          fields.push({ label: 'Pipeline de origem', value: event.metadata.metadata.source_pipeline_name });
        }
        if (event.metadata?.metadata?.source_opportunity_title) {
          fields.push({ label: 'Oportunidade de origem', value: event.metadata.metadata.source_opportunity_title });
        }
        if (event.metadata?.metadata?.acceptor_name) {
          fields.push({ label: 'Cliente que aprovou', value: event.metadata.metadata.acceptor_name });
        }
      }
      break;

    case 'proposal':
      if (event.title) {
        fields.push({ label: 'Título', value: event.title });
      }
      if (event.metadata?.value) {
        fields.push({ label: 'Valor', value: formatCurrency(Number(event.metadata.value)) });
      }
      if (event.metadata?.client_name) {
        fields.push({ label: 'Cliente', value: event.metadata.client_name });
      }
      if (event.metadata?.expires_at) {
        fields.push({ 
          label: 'Validade', 
          value: new Date(event.metadata.expires_at).toLocaleDateString('pt-BR') 
        });
      }
      
      // Show proposal acceptance details
      if (event.activity_type === 'accepted') {
        if (event.proposal_acceptance?.accepted_at) {
          fields.push({ 
            label: 'Aceita em', 
            value: new Date(event.proposal_acceptance.accepted_at).toLocaleString('pt-BR') 
          });
        } else if (event.metadata?.accepted_at) {
          fields.push({ 
            label: 'Aceita em', 
            value: new Date(event.metadata.accepted_at).toLocaleString('pt-BR') 
          });
        }
        
        if (event.proposal_acceptance?.acceptor_name) {
          fields.push({ 
            label: 'Aprovado por', 
            value: (
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">{event.proposal_acceptance.acceptor_name}</span>
              </div>
            )
          });
        }
        
        if (event.proposal_acceptance?.acceptor_position) {
          fields.push({ label: 'Cargo', value: event.proposal_acceptance.acceptor_position });
        }
        
        if (event.proposal_acceptance?.acceptor_document_masked) {
          fields.push({ label: 'Documento', value: event.proposal_acceptance.acceptor_document_masked });
        }
        
        if (event.proposal_acceptance?.acceptance_proof_url) {
          fields.push({ 
            label: 'Comprovante', 
            value: (
              <a 
                href={event.proposal_acceptance.acceptance_proof_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <FileCheck className="h-3.5 w-3.5" />
                Ver comprovante
              </a>
            )
          });
        }
      }
      break;

    case 'file':
      if (event.title) {
        fields.push({ label: 'Arquivo', value: event.title });
      }
      if (event.metadata?.file_type) {
        fields.push({ label: 'Tipo', value: event.metadata.file_type });
      }
      if (event.metadata?.file_size) {
        fields.push({ label: 'Tamanho', value: formatFileSize(Number(event.metadata.file_size)) });
      }
      break;

    case 'automation':
      if (event.title) {
        fields.push({ label: 'Workflow', value: event.title });
      }
      if (event.metadata?.trigger_type) {
        const triggerLabels: Record<string, string> = {
          stage_changed: 'Mudança de estágio',
          status_changed: 'Mudança de status',
          field_updated: 'Campo atualizado',
          activity_completed: 'Atividade concluída',
          opportunity_created: 'Oportunidade criada',
        };
        fields.push({ label: 'Gatilho', value: triggerLabels[event.metadata.trigger_type] || event.metadata.trigger_type });
      }
      if (event.metadata?.status) {
        const statusLabels: Record<string, string> = {
          completed: 'Concluído',
          failed: 'Falhou',
          running: 'Em execução',
        };
        fields.push({ label: 'Status', value: statusLabels[event.metadata.status] || event.metadata.status });
      }
      if (event.metadata?.actions_executed) {
        const actions = Array.isArray(event.metadata.actions_executed) 
          ? event.metadata.actions_executed.length 
          : 0;
        fields.push({ label: 'Ações executadas', value: String(actions) });
      }
      if (event.metadata?.error_message) {
        fields.push({ label: 'Erro', value: event.metadata.error_message });
      }
      break;

    case 'score':
      if (event.metadata?.field) {
        const scoreFieldLabels: Record<string, string> = {
          opportunity_score: 'Score do Deal',
          win_probability_ai: 'Win Probability (IA)',
          nrhs_tier: 'NRHS - Categoria',
          nrhs_score: 'NRHS - Score',
          nrhs_issues_count: 'Lacunas Identificadas',
          lead_score: 'Lead Score',
          fit_score: 'Fit Score',
          intent_score: 'Intent Score',
        };
        fields.push({ label: 'Métrica', value: scoreFieldLabels[event.metadata.field] || event.metadata.field });
      }
      if (event.metadata?.old_value !== undefined && event.metadata?.new_value !== undefined) {
        fields.push({ 
          label: 'Alteração', 
          value: (
            <span className="font-medium">
              {String(event.metadata.old_value || '-')} 
              <span className="text-muted-foreground mx-1">→</span> 
              {String(event.metadata.new_value)}
            </span>
          )
        });
      }
      break;

    case 'vibe':
      if (event.metadata?.alert_type) {
        fields.push({ label: 'Tipo', value: event.metadata.alert_type });
      }
      if (event.metadata?.priority) {
        const priorityLabels: Record<string, string> = {
          high: 'Alta',
          medium: 'Média',
          low: 'Baixa',
        };
        fields.push({ label: 'Prioridade', value: priorityLabels[event.metadata.priority] || event.metadata.priority });
      }
      if (event.metadata?.message) {
        fields.push({ label: 'Mensagem', value: event.metadata.message });
      }
      if (event.metadata?.status) {
        const statusLabels: Record<string, string> = {
          active: 'Ativo',
          acknowledged: 'Reconhecido',
          dismissed: 'Dispensado',
          resolved: 'Resolvido',
        };
        fields.push({ label: 'Status', value: statusLabels[event.metadata.status] || event.metadata.status });
      }
      break;

    case 'ai':
      if (event.metadata?.score_type) {
        const scoreTypeLabels: Record<string, string> = {
          deal_score: 'Deal Score',
          health_score: 'Health Score',
          engagement_score: 'Engagement Score',
          risk_score: 'Risk Score',
        };
        fields.push({ label: 'Tipo', value: scoreTypeLabels[event.metadata.score_type] || event.metadata.score_type });
      }
      if (event.metadata?.score !== undefined) {
        fields.push({ label: 'Score', value: String(event.metadata.score) });
      }
      if (event.metadata?.grade) {
        fields.push({ label: 'Grade', value: event.metadata.grade });
      }
      if (event.metadata?.confidence !== undefined) {
        fields.push({ label: 'Confiança', value: `${Math.round(event.metadata.confidence * 100)}%` });
      }
      if (event.metadata?.explanation) {
        fields.push({ label: 'Explicação', value: event.metadata.explanation });
      }
      break;
  }

  // Determine who did this action
  const actor = event.actor || event.owner;
  const isSystemEvent = event.type === 'automation' || event.type === 'score' || event.type === 'vibe' || event.type === 'ai';
  const isProposalAccepted = event.type === 'proposal' && event.activity_type === 'accepted';

  return (
    <Card className="p-4 relative">
      {/* Timeline dot */}
      <div className={cn("absolute -left-[33px] top-5 w-3 h-3 rounded-full border-2 border-background", iconConfig.bgColor)}></div>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", iconConfig.bgColor)}>
          <div className={iconConfig.textColor}>{iconConfig.icon}</div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Header: Badge + Timestamp */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge variant={badgeVariant} className="text-xs font-medium uppercase tracking-wide">
              {actionLabel}
            </Badge>
            <span className="text-xs text-muted-foreground shrink-0" title={timestamp.absolute}>
              {timestamp.relative}
            </span>
          </div>

          {/* Key-value fields */}
          {fields.length > 0 && (
            <div className="space-y-1.5">
              {fields.map((field, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="font-medium text-muted-foreground shrink-0 w-28">{field.label}:</span>
                  <span className="text-foreground break-words">{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Win/Loss Card for accepted proposals */}
          {isProposalAccepted && event.win_loss && (event.win_loss.win_reason || event.win_loss.key_differentiator || event.win_loss.customer_feedback) && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-800 dark:text-green-300">Feedback do Cliente</span>
              </div>
              
              <div className="space-y-2">
                {event.win_loss.win_reason && (
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs text-green-700 dark:text-green-400">Por que nos escolheu:</span>
                    <span className="text-xs font-medium text-green-800 dark:text-green-200">{event.win_loss.win_reason}</span>
                  </div>
                )}
                
                {event.win_loss.key_differentiator && (
                  <div>
                    <span className="text-xs text-green-700 dark:text-green-400">Diferenciais:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.win_loss.key_differentiator.split(',').map((diff, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                        >
                          {getDifferentiatorLabel(diff.trim())}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {event.win_loss.customer_feedback && (
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600 mt-0.5" />
                    <p className="text-xs italic text-green-800 dark:text-green-200">"{event.win_loss.customer_feedback}"</p>
                  </div>
                )}
                
                {event.win_loss.recorded_by_customer && (
                  <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700">
                    ✓ Feedback registrado pelo cliente
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Footer: Actor/Owner + Absolute timestamp */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {isSystemEvent ? (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <div className="h-5 w-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Sistema</span>
                </>
              ) : isProposalAccepted && event.proposal_acceptance?.acceptor_name ? (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Cliente ({event.proposal_acceptance.acceptor_name})</span>
                </>
              ) : actor ? (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={actor.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {actor.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">{actor.full_name}</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Usuário</span>
                </>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timestamp.absolute}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
