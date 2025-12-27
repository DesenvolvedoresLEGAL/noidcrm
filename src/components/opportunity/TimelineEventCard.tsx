import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  CalendarPlus, CheckCircle, Trash2, XCircle, Mail, Eye, 
  FileText, Send, PartyPopper, Paperclip, Zap, GitBranch, 
  Edit3, Plus, Phone, Users, MessageSquare, Calendar, 
  Clock, Bot, StickyNote, ArrowRightLeft, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
        const fieldLabels: Record<string, string> = {
          stage_id: 'Estágio',
          status: 'Status',
          value: 'Valor',
          expected_close_date: 'Previsão de fechamento',
          owner_user_id: 'Responsável',
          contact_id: 'Contato',
          account_id: 'Conta',
          temperature: 'Temperatura',
          probability: 'Probabilidade',
        };
        fields.push({ label: 'Campo', value: fieldLabels[event.metadata.field_name] || event.metadata.field_name });
      }
      if (event.metadata?.old_value !== undefined && event.metadata?.new_value !== undefined) {
        // Use resolved labels if available, otherwise fall back to raw values
        const oldVal = event.metadata.old_value_label 
          || (typeof event.metadata.old_value === 'object' 
            ? JSON.stringify(event.metadata.old_value) 
            : String(event.metadata.old_value || '-'));
        const newVal = event.metadata.new_value_label 
          || (typeof event.metadata.new_value === 'object' 
            ? JSON.stringify(event.metadata.new_value) 
            : String(event.metadata.new_value || '-'));
        fields.push({ 
          label: 'Alteração', 
          value: <span className="font-medium">{oldVal} <span className="text-muted-foreground">→</span> {newVal}</span>
        });
      }
      // Extra for proposal_accepted
      if (event.activity_type === 'proposal_accepted') {
        if (event.metadata?.metadata?.proposal_value) {
          fields.push({ label: 'Valor', value: formatCurrency(event.metadata.metadata.proposal_value) });
        }
        if (event.metadata?.metadata?.acceptor_name) {
          fields.push({ label: 'Aprovado por', value: event.metadata.metadata.acceptor_name });
        }
      }
      // Extra for handoff
      if (event.activity_type === 'handoff_received') {
        if (event.metadata?.metadata?.source_pipeline_name) {
          fields.push({ label: 'Pipeline de origem', value: event.metadata.metadata.source_pipeline_name });
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
      if (event.metadata?.accepted_at) {
        fields.push({ 
          label: 'Aceita em', 
          value: new Date(event.metadata.accepted_at).toLocaleString('pt-BR') 
        });
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
  }

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
                  <span className="font-medium text-muted-foreground shrink-0 w-24">{field.label}:</span>
                  <span className="text-foreground break-words">{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer: Owner + Absolute timestamp */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {event.owner ? (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={event.owner.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {event.owner.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">{event.owner.full_name}</span>
                </>
              ) : event.type === 'automation' ? (
                <>
                  <span className="text-xs text-muted-foreground">Por:</span>
                  <div className="h-5 w-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Sistema</span>
                </>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">{timestamp.absolute}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
