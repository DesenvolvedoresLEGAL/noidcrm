import { useEffect, useState } from 'react';
import type { InboxItem } from '@/hooks/useUnifiedInbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ExternalLink,
  Check,
  X,
  Clock,
  Mail,
  Bell,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { trackNotificationClick } from '@/lib/notifications/trackClick';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onMarkRead: (item: InboxItem) => void;
  onDismiss: (item: InboxItem) => void;
  onSnooze: (item: InboxItem, hours: number) => void;
}

const PRIORITY_LABEL = {
  critical: { label: 'Crítico', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'Alta', className: 'bg-orange-500 text-white' },
  medium: { label: 'Média', className: 'bg-primary text-primary-foreground' },
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
} as const;

export function NotificationDetailPanel({
  item,
  open,
  onClose,
  onMarkRead,
  onDismiss,
  onSnooze,
}: Props) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);

  const realId = item?.source === 'v2' ? item.id : null;

  const { data: deliveryLogs } = useQuery({
    queryKey: ['notif-delivery-logs', realId],
    queryFn: async () => {
      if (!realId) return [];
      const { data, error } = await supabase
        .from('notification_delivery_logs' as any)
        .select('*')
        .eq('notification_id', realId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[detail] delivery logs failed', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!realId && open,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    setLogs(deliveryLogs ?? []);
  }, [deliveryLogs]);

  if (!item) return null;

  const prio = PRIORITY_LABEL[item.priority];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 space-y-0 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={prio.className}>{prio.label}</Badge>
            {item.source === 'release_note' && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Novidade
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {item.type}
            </Badge>
          </div>
          <SheetTitle className="text-lg leading-tight">{item.title}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Recebida em{' '}
            {format(new Date(item.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {item.message && (
              <section>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Mensagem
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.message}</p>
              </section>
            )}

            {/* Timeline */}
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Linha do tempo
              </h4>
              <ol className="space-y-3 border-l-2 border-border pl-4 ml-1">
                <TimelineEvent
                  label="Criada"
                  date={item.created_at}
                  icon={<Bell className="h-3 w-3" />}
                  done
                />
                {item.read_at && (
                  <TimelineEvent
                    label="Lida"
                    date={item.read_at}
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    done
                  />
                )}
                {item.snoozed_until && (
                  <TimelineEvent
                    label="Adiada até"
                    date={item.snoozed_until}
                    icon={<Clock className="h-3 w-3" />}
                    done={new Date(item.snoozed_until) <= new Date()}
                  />
                )}
                {item.dismissed_at && (
                  <TimelineEvent
                    label="Dispensada"
                    date={item.dismissed_at}
                    icon={<X className="h-3 w-3" />}
                    done
                  />
                )}
              </ol>
            </section>

            {/* Delivery logs */}
            {logs.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Entregas
                </h4>
                <ul className="space-y-2">
                  {logs.map((log: any) => (
                    <li
                      key={log.id}
                      className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/40"
                    >
                      {log.channel === 'email' ? (
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                      ) : log.channel === 'push' ? (
                        <Smartphone className="h-3.5 w-3.5 text-purple-500" />
                      ) : (
                        <Bell className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="font-medium capitalize">{log.channel}</span>
                      <span className="text-muted-foreground">
                        {log.delivered_at
                          ? format(new Date(log.delivered_at), 'HH:mm')
                          : log.failed_at
                            ? 'Falhou'
                            : 'Pendente'}
                      </span>
                      {log.failed_at && <AlertCircle className="h-3 w-3 text-destructive ml-auto" />}
                      {log.delivered_at && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Metadata */}
            {item.meta && Object.keys(item.meta).length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Detalhes técnicos
                </h4>
                <pre className="text-[10px] bg-muted p-3 rounded-md overflow-x-auto leading-relaxed">
                  {JSON.stringify(item.meta, null, 2)}
                </pre>
              </section>
            )}

            <Separator />

            <section className="text-[10px] text-muted-foreground space-y-1">
              <div>
                <span className="font-semibold">ID:</span> {item.id}
              </div>
              <div>
                <span className="font-semibold">Origem:</span>{' '}
                {item.source === 'v2' ? 'Sistema PRIME' : item.source === 'v1' ? 'Legado' : 'Release Note'}
              </div>
              <div>
                <span className="font-semibold">Categoria:</span> {item.category}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="border-t p-3 flex flex-wrap items-center gap-2 bg-muted/30">
          {item.action_url && (
            <Button
              size="sm"
              className="gap-1.5 flex-1 min-w-[120px]"
              onClick={() => {
                onMarkRead(item);
                onClose();
                navigate(item.action_url!);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir destino
            </Button>
          )}
          {!item.read_at && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onMarkRead(item)}>
              <Check className="h-3.5 w-3.5" />
              Marcar lida
            </Button>
          )}
          {item.source === 'v2' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Adiar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSnooze(item, 1)}>1 hora</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(item, 4)}>4 horas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(item, 24)}>Amanhã</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!item.dismissed_at && item.source !== 'release_note' && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => {
                onDismiss(item);
                onClose();
              }}
            >
              <X className="h-3.5 w-3.5" />
              Dispensar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TimelineEvent({
  label,
  date,
  icon,
  done,
}: {
  label: string;
  date: string;
  icon: React.ReactNode;
  done?: boolean;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[22px] top-0.5 h-4 w-4 rounded-full flex items-center justify-center ${
          done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] text-muted-foreground">
          {format(new Date(date), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </li>
  );
}
