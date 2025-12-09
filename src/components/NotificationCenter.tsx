import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Bell, Megaphone, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DealWonCelebrationModal } from '@/components/notifications/DealWonCelebrationModal';

interface DatabaseReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string | null;
  release_date: string;
  is_major: boolean;
  changes: Array<{ type: string; description: string }>;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    celebrationNotification,
    dismissCelebration,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<'notifications' | 'news'>('notifications');
  const [open, setOpen] = useState(false);

  // Fetch release notes from database
  const { data: releaseNotes = [] } = useQuery({
    queryKey: ['release-notes-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('release_notes')
        .select('id, version, title, description, release_date, is_major, changes')
        .order('release_date', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching release notes:', error);
        return [];
      }
      return (data || []) as DatabaseReleaseNote[];
    },
  });

  // Calculate unread news (stored in localStorage)
  const [readNewsIds, setReadNewsIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('read_news_ids');
    return stored ? JSON.parse(stored) : [];
  });

  const unreadNewsCount = releaseNotes.filter(note => !readNewsIds.includes(note.id)).length;
  const totalUnread = unreadCount + unreadNewsCount;

  const markNewsAsRead = (id: string) => {
    const newReadIds = [...readNewsIds, id];
    setReadNewsIds(newReadIds);
    localStorage.setItem('read_news_ids', JSON.stringify(newReadIds));
  };

  const markAllNewsAsRead = () => {
    const allIds = releaseNotes.map(note => note.id);
    setReadNewsIds(allIds);
    localStorage.setItem('read_news_ids', JSON.stringify(allIds));
  };

  const handleViewAllUpdates = () => {
    setOpen(false);
    navigate('/app/release-notes');
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-8 w-8 hover:bg-primary/10"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] animate-pulse"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-96 p-0 z-50 bg-popover" 
        align="end"
        sideOffset={8}
      >
        <Tabs defaultValue="notifications" onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="border-b px-3 pt-3 pb-2">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="notifications" className="text-xs relative">
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="news" className="text-xs relative">
                <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                Novidades
                {unreadNewsCount > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                    {unreadNewsCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="m-0">
            {unreadCount > 0 && (
              <div className="flex justify-end px-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todas como lidas
                </Button>
              </div>
            )}
            <ScrollArea className="h-[300px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                  <p className="text-xs mt-1">Nenhuma notificação pendente</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-3 hover:bg-accent/50 cursor-pointer transition-colors',
                        !notification.read && 'bg-primary/5'
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        )}
                        <div className={cn('flex-1 min-w-0', notification.read && 'ml-5')}>
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="m-0">
            {unreadNewsCount > 0 && (
              <div className="flex justify-end px-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllNewsAsRead}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todas como lidas
                </Button>
              </div>
            )}
            <ScrollArea className="h-[300px]">
              {releaseNotes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Em breve!</p>
                  <p className="text-xs mt-1">Novidades serão anunciadas aqui</p>
                </div>
              ) : (
                <div className="divide-y">
                  {releaseNotes.map((note) => (
                    <ReleaseNoteItem
                      key={note.id}
                      note={note}
                      isRead={readNewsIds.includes(note.id)}
                      onRead={() => markNewsAsRead(note.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {/* Ver todas as atualizações button */}
            <div className="p-3 border-t">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-xs h-8 gap-2"
                onClick={handleViewAllUpdates}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver todas as atualizações
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>

    {/* Celebration Modal */}
    <DealWonCelebrationModal
      notification={celebrationNotification}
      open={!!celebrationNotification}
      onClose={dismissCelebration}
    />
  </>
  );
}

function ReleaseNoteItem({ 
  note, 
  isRead, 
  onRead 
}: { 
  note: DatabaseReleaseNote; 
  isRead: boolean; 
  onRead: () => void;
}) {
  // Determine the primary type from changes array or default to feature
  const primaryChange = note.changes?.[0];
  const noteType = (primaryChange?.type as 'feature' | 'improvement' | 'fix') || 'feature';

  const typeColors = {
    feature: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    improvement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    fix: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  const typeLabels = {
    feature: 'Novo',
    improvement: 'Melhoria',
    fix: 'Correção',
  };

  return (
    <div
      className={cn(
        'p-3 hover:bg-accent/50 cursor-pointer transition-colors',
        !isRead && 'bg-primary/5'
      )}
      onClick={onRead}
    >
      <div className="flex items-start gap-3">
        {!isRead && (
          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
        )}
        <div className={cn('flex-1 min-w-0', isRead && 'ml-5')}>
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="secondary" 
              className={cn('text-[10px] px-1.5 py-0 h-4', typeColors[noteType])}
            >
              {typeLabels[noteType]}
            </Badge>
            <span className="text-[10px] text-muted-foreground/70">
              v{note.version}
            </span>
            {note.is_major && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/50 text-primary">
                Major
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm">{note.title}</p>
          {note.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {note.description}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
            {formatDistanceToNow(new Date(note.release_date), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
