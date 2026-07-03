import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trackNotificationClick } from '@/lib/notifications/trackClick';

// Sprint PERF 0.2 — defense-in-depth: o Layout já só monta este componente
// dentro de /app/* protegido, mas garantimos aqui que rotas públicas nunca
// abrem WS de notificação caso o componente seja reutilizado no futuro.
const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/accept-invitation',
  '/public/',
  '/p/',
  '/f/',
  '/proposta-publica',
  '/terms',
  '/privacy',
  '/agendar-demo',
  '/docs',
  '/status/auth',
  '/admin/login',
];

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

// Priority event types that trigger browser push
const PUSH_PRIORITY_TYPES = new Set([
  'proposal_viewed',
  'client_replied',
  'proposal_expiring_24h',
  'proposal_expired',
  'activity_overdue_critical',
  'daily_digest',
]);

async function triggerBrowserPush(row: any) {
  // Only trigger for priority events when tab is not focused
  if (document.hasFocus()) return;
  if (!PUSH_PRIORITY_TYPES.has(row.type)) return;

  try {
    await supabase.functions.invoke('send-browser-push', {
      body: {
        user_id: row.user_id,
        title: row.title,
        body: row.message || '',
        action_url: row.action_url || '/app/dashboard',
        notification_id: row.id,
      },
    });
  } catch (err) {
    console.error('Browser push trigger failed:', err);
  }
}

export function RealtimeNotificationListener() {
  const { user } = useCurrentUser();
  const { settings } = useNotificationSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?.id;
  const organizationId = user?.organization_id;
  const onPublicRoute = isPublicRoute(location.pathname);

  useEffect(() => {
    if (onPublicRoute) return;
    if (!userId || !settings?.realtime_in_app_enabled) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_v2',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;

          if (!row.channel_in_app) return;
          if (row.status !== 'pending' && row.status !== 'sent') return;

          // Invalidate notification center cache
          queryClient.invalidateQueries({ queryKey: ['notifications-center', userId] });
          queryClient.invalidateQueries({ queryKey: ['unified-inbox', 'v2', userId] });

          // Trigger browser push only when user enabled push AND notification opted into push channel
          if (settings?.realtime_browser_push_enabled && row.channel_push === true) {
            triggerBrowserPush(row);
          } else if (PUSH_PRIORITY_TYPES.has(row.type)) {
            console.debug(
              '[notifications] browser push skipped: preference disabled or channel_push=false',
              {
                type: row.type,
                notification_id: row.id,
                realtime_browser_push_enabled: !!settings?.realtime_browser_push_enabled,
                channel_push: row.channel_push === true,
              }
            );
          }

          // Determine toast type by priority
          const isCritical = row.priority === 'critical';
          const isHigh = row.priority === 'high';
          const toastFn = isCritical ? toast.warning : isHigh ? toast.info : toast;

          const actionLabel = row.type === 'client_replied' ? 'Abrir conversa' : 'Abrir';

          toastFn(row.title, {
            description: row.message || undefined,
            duration: isCritical ? 15000 : isHigh ? 10000 : 8000,
            action: row.action_url
              ? {
                  label: actionLabel,
                  onClick: () => {
                    trackNotificationClick(row.id);
                    navigate(row.action_url);
                  },
                }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    onPublicRoute,
    userId,
    settings?.realtime_in_app_enabled,
    settings?.realtime_browser_push_enabled,
    queryClient,
    navigate,
  ]);

  // Global proposal_alerts listener — surfaces "cliente visualizando agora" popup
  // in any screen, not only on the proposal detail page.
  useEffect(() => {
    if (onPublicRoute) return;
    if (!organizationId || !settings?.realtime_in_app_enabled) return;

    const shownIds = new Set<string>();

    const channel = supabase
      .channel(`proposal-alerts-global-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposal_alerts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const alert = payload.new as any;
          if (!alert?.id || shownIds.has(alert.id)) return;
          shownIds.add(alert.id);

          const map: Record<string, { icon: string; headline: string }> = {
            viewing_now: { icon: '🔴', headline: 'Cliente visualizando agora!' },
            forwarded: { icon: '📤', headline: 'Proposta encaminhada' },
            high_engagement: { icon: '🔥', headline: 'Alto engajamento' },
            ready_to_close: { icon: '✅', headline: 'Pronto para fechar' },
            competitor_signal: { icon: '⚔️', headline: 'Possível comparação' },
            deadline_approaching: { icon: '⏰', headline: 'Validade próxima' },
            price_focus: { icon: '💰', headline: 'Foco em preços' },
          };
          const cfg = map[alert.alert_type];
          if (!cfg) return;

          const toastFn = alert.severity === 'critical' ? toast.warning : toast.info;
          toastFn(`${cfg.icon} ${alert.title || cfg.headline}`, {
            description: alert.message || undefined,
            duration: alert.alert_type === 'viewing_now' ? 12000 : 9000,
            action: alert.proposal_id
              ? {
                  label: 'Abrir proposta',
                  onClick: () => navigate(`/app/proposals/${alert.proposal_id}`),
                }
              : undefined,
          });

          queryClient.invalidateQueries({ queryKey: ['proposal-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onPublicRoute, organizationId, settings?.realtime_in_app_enabled, queryClient, navigate]);

  return null;
}
