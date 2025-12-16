import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { listInteractions, type Interaction, type InteractionChannel } from '@/services/crm/interactions';
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, MessageSquare, Calendar, Linkedin, Globe, FileText, 
  Users, CheckCircle, XCircle, Eye, ArrowRight, ArrowLeft, Minus,
  Search, Filter, TrendingUp, TrendingDown, Meh, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractionsTimelineProps {
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  title?: string;
  maxHeight?: string;
  showFilters?: boolean;
  compact?: boolean;
}

const channelConfig: Record<InteractionChannel, { icon: typeof Phone; color: string; label: string }> = {
  phone: { icon: Phone, color: 'text-blue-500 bg-blue-500/10', label: 'Telefone' },
  email: { icon: Mail, color: 'text-purple-500 bg-purple-500/10', label: 'E-mail' },
  whatsapp: { icon: MessageSquare, color: 'text-green-500 bg-green-500/10', label: 'WhatsApp' },
  linkedin: { icon: Linkedin, color: 'text-sky-500 bg-sky-500/10', label: 'LinkedIn' },
  meeting: { icon: Calendar, color: 'text-orange-500 bg-orange-500/10', label: 'Reunião' },
  form: { icon: FileText, color: 'text-pink-500 bg-pink-500/10', label: 'Formulário' },
  chat: { icon: MessageSquare, color: 'text-teal-500 bg-teal-500/10', label: 'Chat' },
  website: { icon: Globe, color: 'text-indigo-500 bg-indigo-500/10', label: 'Website' },
  proposal: { icon: FileText, color: 'text-yellow-500 bg-yellow-500/10', label: 'Proposta' },
  contract: { icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10', label: 'Contrato' },
  other: { icon: Users, color: 'text-gray-500 bg-gray-500/10', label: 'Outro' },
};

const sentimentConfig = {
  positive: { icon: TrendingUp, color: 'text-green-500', label: 'Positivo' },
  neutral: { icon: Meh, color: 'text-gray-500', label: 'Neutro' },
  negative: { icon: TrendingDown, color: 'text-red-500', label: 'Negativo' },
  unknown: { icon: Minus, color: 'text-muted-foreground', label: 'N/A' },
};

const directionConfig = {
  inbound: { icon: ArrowLeft, color: 'text-blue-500', label: 'Entrada' },
  outbound: { icon: ArrowRight, color: 'text-green-500', label: 'Saída' },
  bidirectional: { icon: Minus, color: 'text-gray-500', label: 'Bidirecional' },
};

function getDateGroup(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (isThisWeek(date)) return 'Esta Semana';
  return format(date, 'MMMM yyyy', { locale: ptBR });
}

export function InteractionsTimeline({
  accountId,
  contactId,
  opportunityId,
  title = 'Timeline de Interações',
  maxHeight = '600px',
  showFilters = true,
  compact = false,
}: InteractionsTimelineProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['interactions', { accountId, contactId, opportunityId }],
    queryFn: () => listInteractions({ account_id: accountId, contact_id: contactId, opportunity_id: opportunityId }),
    enabled: !!(accountId || contactId || opportunityId),
  });

  // Filter interactions
  const filteredInteractions = useMemo(() => {
    return interactions.filter(interaction => {
      const matchesSearch = !searchTerm || 
        interaction.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interaction.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interaction.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesChannel = channelFilter === 'all' || interaction.channel === channelFilter;
      const matchesSentiment = sentimentFilter === 'all' || interaction.sentiment === sentimentFilter;
      
      return matchesSearch && matchesChannel && matchesSentiment;
    });
  }, [interactions, searchTerm, channelFilter, sentimentFilter]);

  // Group by date
  const groupedInteractions = useMemo(() => {
    const groups: Record<string, Interaction[]> = {};
    
    filteredInteractions.forEach(interaction => {
      const date = new Date(interaction.occurred_at);
      const group = getDateGroup(date);
      if (!groups[group]) groups[group] = [];
      groups[group].push(interaction);
    });
    
    return groups;
  }, [filteredInteractions]);

  // Stats
  const stats = useMemo(() => {
    const total = interactions.length;
    const channels: Record<string, number> = {};
    const sentiments: Record<string, number> = {};
    
    interactions.forEach(i => {
      channels[i.channel] = (channels[i.channel] || 0) + 1;
      if (i.sentiment) {
        sentiments[i.sentiment] = (sentiments[i.sentiment] || 0) + 1;
      }
    });
    
    return { total, channels, sentiments };
  }, [interactions]);

  const renderInteractionItem = (interaction: Interaction) => {
    const channel = channelConfig[interaction.channel] || channelConfig.other;
    const sentiment = interaction.sentiment ? sentimentConfig[interaction.sentiment] : null;
    const direction = directionConfig[interaction.direction];
    const ChannelIcon = channel.icon;
    const DirectionIcon = direction.icon;
    const SentimentIcon = sentiment?.icon;

    return (
      <div 
        key={interaction.id} 
        className={cn(
          "relative pl-8 pb-4 border-l-2 border-border ml-3 group",
          compact && "pb-2"
        )}
      >
        {/* Timeline dot */}
        <div className={cn(
          "absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center",
          channel.color
        )}>
          <ChannelIcon className="h-3 w-3" />
        </div>

        <div className={cn(
          "bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow",
          compact && "p-2"
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {channel.label}
                </Badge>
                <DirectionIcon className={cn("h-3 w-3", direction.color)} />
                {sentiment && SentimentIcon && (
                  <SentimentIcon className={cn("h-3 w-3", sentiment.color)} />
                )}
                {interaction.engagement_score && interaction.engagement_score > 50 && (
                  <Badge variant="secondary" className="text-xs">
                    {interaction.engagement_score}pts
                  </Badge>
                )}
              </div>

              {/* Subject */}
              {interaction.subject && (
                <p className={cn(
                  "font-medium text-sm mt-1 truncate",
                  compact && "text-xs"
                )}>
                  {interaction.subject}
                </p>
              )}

              {/* Content preview */}
              {interaction.summary && !compact && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {interaction.summary}
                </p>
              )}
              {!interaction.summary && interaction.content && !compact && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {interaction.content}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(interaction.occurred_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
                {interaction.duration_seconds && (
                  <span>{Math.round(interaction.duration_seconds / 60)} min</span>
                )}
                {interaction.actor && (
                  <span className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={interaction.actor.avatar_url} />
                      <AvatarFallback className="text-[8px]">
                        {interaction.actor.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {interaction.actor.full_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!accountId && !contactId && !opportunityId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma conta, contato ou oportunidade para ver a timeline.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">{stats.total} interações</Badge>
        </div>

        {/* Stats mini cards */}
        {!compact && stats.total > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {Object.entries(stats.channels).slice(0, 5).map(([ch, count]) => {
              const config = channelConfig[ch as InteractionChannel] || channelConfig.other;
              return (
                <Badge key={ch} variant="outline" className="text-xs">
                  <config.icon className={cn("h-3 w-3 mr-1", config.color.split(' ')[0])} />
                  {count}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos canais</SelectItem>
                {Object.entries(channelConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className={cn("h-3 w-3", config.color.split(' ')[0])} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Sentimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(sentimentConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className={cn("h-3 w-3", config.color)} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredInteractions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma interação encontrada</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-4">
              {Object.entries(groupedInteractions).map(([dateGroup, items]) => (
                <div key={dateGroup}>
                  <div className="sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {dateGroup}
                    </p>
                  </div>
                  <div className="space-y-0">
                    {items.map(renderInteractionItem)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
