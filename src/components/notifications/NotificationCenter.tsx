import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, ExternalLink, Filter } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useNotificationsCenter, type NotificationFilter, type NotificationPriority } from '@/hooks/useNotificationsCenter';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  critical: 'border-l-4 border-l-destructive bg-destructive/5',
  high: 'border-l-4 border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-4 border-l-primary/50',
  low: '',
};

const PRIORITY_BADGE: Record<NotificationPriority, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  critical: { label: 'Crítico', variant: 'destructive' },
  high: { label: 'Alta', variant: 'default' },
  medium: { label: 'Média', variant: 'secondary' },
  low: { label: 'Baixa', variant: 'outline' },
};

const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'unread', label: 'Não lidas' },
  { value: 'proposals', label: 'Propostas' },
  { value: 'activities', label: 'Atividades' },
  { value: 'replies', label: 'Respostas' },
];

export function NotificationCenter() {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
  } = useNotificationsCenter(filter);

  const handleOpen = (url: string | null, id: string) => {
    markAsRead(id);
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => markAllAsRead()}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pb-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as NotificationFilter)}>
            <TabsList className="w-full grid grid-cols-5 h-8">
              {FILTER_TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs px-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Separator />

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação encontrada.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => {
                const isUnread = !n.read_at;
                const badge = PRIORITY_BADGE[n.priority];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'px-4 py-3 transition-colors hover:bg-muted/50',
                      isUnread && 'bg-primary/[0.02]',
                      PRIORITY_STYLES[n.priority],
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('text-sm font-medium truncate', isUnread && 'font-semibold')}>
                            {n.title}
                          </span>
                          {n.priority !== 'low' && (
                            <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                              {badge.label}
                            </Badge>
                          )}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{n.message}</p>
                        )}
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-2 ml-4">
                      {n.action_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleOpen(n.action_url, n.id)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir
                        </Button>
                      )}
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => markAsRead(n.id)}
                        >
                          <Check className="h-3 w-3" />
                          Lida
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => dismiss(n.id)}
                      >
                        <X className="h-3 w-3" />
                        Dispensar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
