import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Inbox,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  Clock,
  Settings,
  AlertTriangle,
  CalendarDays,
  FileText,
  MessageSquare,
  Megaphone,
  Sun,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trackNotificationClick } from '@/lib/notifications/trackClick';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useUnifiedInbox,
  usePersistedInboxTab,
  type InboxItem,
  type InboxCategory,
  type InboxPriority,
} from '@/hooks/useUnifiedInbox';

interface Props {
  collapsed?: boolean;
}

const PRIORITY_STYLES: Record<InboxPriority, string> = {
  critical: 'border-l-4 border-l-destructive bg-destructive/5',
  high: 'border-l-4 border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-4 border-l-primary/40',
  low: 'border-l-4 border-l-transparent',
};

const PRIORITY_BADGE: Record<
  InboxPriority,
  { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }
> = {
  critical: { label: 'Crítico', variant: 'destructive' },
  high: { label: 'Alta', variant: 'default' },
  medium: { label: 'Média', variant: 'secondary' },
  low: { label: 'Baixa', variant: 'outline' },
};

const TABS: { value: InboxCategory; label: string; icon: any }[] = [
  { value: 'priority', label: 'Prioridade', icon: AlertTriangle },
  { value: 'activities', label: 'Atividades', icon: CalendarDays },
  { value: 'proposals', label: 'Propostas', icon: FileText },
  { value: 'conversations', label: 'Conversas', icon: MessageSquare },
  { value: 'news', label: 'Novidades', icon: Megaphone },
  { value: 'all', label: 'Tudo', icon: Inbox },
];

function filterByTab(items: InboxItem[], tab: InboxCategory): InboxItem[] {
  if (tab === 'all') return items;
  if (tab === 'priority') {
    return items.filter(
      (i) => (i.priority === 'critical' || i.priority === 'high') && !i.read_at,
    );
  }
  return items.filter((i) => i.category === tab);
}

export function UnifiedNotificationInbox({ collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = usePersistedInboxTab('priority');
  const navigate = useNavigate();
  const { items, counts, digest, isLoading, markRead, dismiss, snooze, markAllRead } =
    useUnifiedInbox({ active: open });

  const visible = filterByTab(items, tab);

  const handleOpen = (item: InboxItem) => {
    markRead(item);
    if (item.action_url) {
      trackNotificationClick(item.id);
      setOpen(false);
      navigate(item.action_url);
    }
  };

  const tabBadge = (val: InboxCategory): number => {
    switch (val) {
      case 'priority':
        return counts.priority;
      case 'activities':
        return counts.activities;
      case 'proposals':
        return counts.proposals;
      case 'conversations':
        return counts.conversations;
      case 'news':
        return counts.news;
      case 'all':
        return counts.unread;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative hover:bg-primary/10',
            collapsed ? 'h-8 w-8' : 'h-8 w-8',
          )}
          aria-label={`Caixa de entrada (${counts.badge} novas)`}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {counts.badge > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[10px] animate-pulse"
            >
              {counts.badge > 9 ? '9+' : counts.badge}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 space-y-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-5 w-5 text-primary" />
              Caixa de Entrada
              {counts.unread > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {counts.unread}
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {counts.unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => markAllRead()}
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tudo lido
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="px-3 pb-2 border-b">
          <Tabs value={tab} onValueChange={(v) => setTab(v as InboxCategory)}>
            <TabsList className="w-full grid grid-cols-6 h-8 p-0.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const badge = tabBadge(t.value);
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="text-[10px] px-1 gap-1 relative"
                    title={t.label}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden lg:inline">{t.label}</span>
                    {badge > 0 && (
                      <span className="ml-0.5 bg-destructive text-destructive-foreground rounded-full px-1 text-[9px] leading-tight">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Sticky Daily Digest */}
        {digest && (tab === 'priority' || tab === 'all') && (
          <div className="px-4 py-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
            <div className="flex items-start gap-2">
              <Sun className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">Resumo do dia</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/app/dashboard');
                    }}
                  >
                    Abrir
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {!!digest.overdue_activities && (
                    <span>🔴 {digest.overdue_activities} atrasadas</span>
                  )}
                  {!!digest.today_activities && (
                    <span>📅 {digest.today_activities} hoje</span>
                  )}
                  {!!digest.proposals_due_today && (
                    <span>📄 {digest.proposals_due_today} venc. hoje</span>
                  )}
                  {!!digest.proposals_viewed_24h && (
                    <span>👁️ {digest.proposals_viewed_24h} vistas</span>
                  )}
                  {!!digest.client_replies_24h && (
                    <span>💬 {digest.client_replies_24h} respostas</span>
                  )}
                  {!!digest.proposals_due_tomorrow && (
                    <span>⏰ {digest.proposals_due_tomorrow} venc. amanhã</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">Tudo em dia! 🎉</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tab === 'priority'
                  ? 'Nenhum item prioritário pendente.'
                  : 'Nenhuma notificação nesta categoria.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  onOpen={handleOpen}
                  onRead={markRead}
                  onDismiss={dismiss}
                  onSnooze={(hours) => snooze({ item, hours })}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-3 flex items-center justify-between gap-2 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => {
              setOpen(false);
              navigate('/app/settings/notifications');
            }}
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => {
              setOpen(false);
              navigate('/app/notifications');
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Histórico completo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface RowProps {
  item: InboxItem;
  onOpen: (item: InboxItem) => void;
  onRead: (item: InboxItem) => void;
  onDismiss: (item: InboxItem) => void;
  onSnooze: (hours: number) => void;
}

function InboxRow({ item, onOpen, onRead, onDismiss, onSnooze }: RowProps) {
  const isUnread = !item.read_at;
  const badge = PRIORITY_BADGE[item.priority];
  const isNews = item.source === 'release_note';

  return (
    <div
      className={cn(
        'px-4 py-3 transition-colors hover:bg-muted/40',
        isUnread && 'bg-primary/[0.02]',
        PRIORITY_STYLES[item.priority],
      )}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className={cn(
                'text-sm truncate',
                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
              )}
            >
              {item.title}
            </span>
            {isNews ? (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-primary/40 text-primary"
              >
                Novidade
              </Badge>
            ) : item.priority === 'critical' || item.priority === 'high' ? (
              <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                {badge.label}
              </Badge>
            ) : null}
          </div>
          {item.message && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{item.message}</p>
          )}
          <span className="text-[11px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2 ml-4">
        {item.action_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onOpen(item)}
          >
            <ExternalLink className="h-3 w-3" />
            Abrir
          </Button>
        )}
        {isUnread && !isNews && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onRead(item)}
          >
            <Check className="h-3 w-3" />
            Lida
          </Button>
        )}
        {item.source === 'v2' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Adiar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onSnooze(1)}>Adiar 1 hora</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(4)}>Adiar 4 horas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(24)}>Amanhã</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isNews && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => onDismiss(item)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
