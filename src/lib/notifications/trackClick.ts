import { supabase } from '@/integrations/supabase/client';

/**
 * Registra clique em uma notificação para alimentar as métricas admin
 * (taxa de clique, top eventos por engajamento). Fire-and-forget — nunca
 * bloqueia a navegação do usuário.
 */
export function trackNotificationClick(notificationId: string): void {
  if (!notificationId) return;
  void supabase.functions
    .invoke('track-notification-click', { body: { notification_id: notificationId } })
    .catch((err) => {
      // Telemetria silenciosa — clique não pode falhar a UX
      console.debug('[track-notification-click] failed:', err);
    });
}
