import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RealtimeViewer {
  sessionId: string;
  viewedAt: string;
  deviceType?: string;
  city?: string;
}

interface UseProposalRealtimeReturn {
  activeViewers: RealtimeViewer[];
  isViewingNow: boolean;
  lastViewerName: string | null;
}

export function useProposalRealtime(proposalId: string | undefined): UseProposalRealtimeReturn {
  const [activeViewers, setActiveViewers] = useState<RealtimeViewer[]>([]);
  const [lastViewerName, setLastViewerName] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check if a view is recent (within last 2 minutes)
  const isRecentView = useCallback((viewedAt: string) => {
    const viewTime = new Date(viewedAt).getTime();
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    return viewTime > twoMinutesAgo;
  }, []);

  useEffect(() => {
    if (!proposalId) return;

    // Subscribe to new views
    const channel = supabase
      .channel(`proposal-views-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposal_views',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          console.log('[Realtime] New proposal view:', payload);
          const newView = payload.new as any;
          
          // Add to active viewers
          setActiveViewers((prev) => {
            const exists = prev.some(v => v.sessionId === newView.session_id);
            if (exists) return prev;
            return [...prev, {
              sessionId: newView.session_id || newView.id,
              viewedAt: newView.viewed_at,
              deviceType: newView.device_type,
              city: newView.city,
            }];
          });

          // Show toast notification
          const location = newView.city ? ` de ${newView.city}` : '';
          const device = newView.device_type ? ` (${newView.device_type})` : '';
          toast.success(
            `👁️ Alguém está visualizando sua proposta${location}${device}!`,
            {
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Scroll to analytics section
                  document.querySelector('[data-analytics-tab]')?.scrollIntoView({ behavior: 'smooth' });
                },
              },
            }
          );

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['proposal-views', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal-analytics', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal-alerts', proposalId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'proposal_views',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          console.log('[Realtime] View updated:', payload);
          const updatedView = payload.new as any;
          
          // Update viewer info
          setActiveViewers((prev) => 
            prev.map(v => 
              v.sessionId === updatedView.session_id 
                ? { ...v, viewedAt: updatedView.viewed_at || updatedView.view_end_at }
                : v
            )
          );

          // If view ended (has view_end_at), remove from active viewers after delay
          if (updatedView.view_end_at) {
            setTimeout(() => {
              setActiveViewers((prev) => 
                prev.filter(v => v.sessionId !== updatedView.session_id)
              );
            }, 5000);
          }

          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['proposal-views', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal-analytics', proposalId] });
        }
      )
      .subscribe();

    // Subscribe to new alerts
    const alertsChannel = supabase
      .channel(`proposal-alerts-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposal_alerts',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          console.log('[Realtime] New alert:', payload);
          const newAlert = payload.new as any;
          
          // Show toast based on alert type
          const alertToasts: Record<string, { icon: string; message: string }> = {
            viewing_now: { icon: '🔴', message: 'Cliente está online AGORA!' },
            forwarded: { icon: '📤', message: 'Proposta foi encaminhada para outra pessoa!' },
            high_engagement: { icon: '🔥', message: 'Alto engajamento detectado!' },
            price_focus: { icon: '💰', message: 'Cliente focado na seção de preços!' },
            ready_to_close: { icon: '✅', message: 'Cliente pronto para fechar!' },
            competitor_signal: { icon: '⚔️', message: 'Possível comparação com concorrente detectada!' },
            deadline_approaching: { icon: '⏰', message: 'Validade próxima e sem resposta!' },
          };

          const alertConfig = alertToasts[newAlert.alert_type];
          if (alertConfig) {
            toast(
              `${alertConfig.icon} ${alertConfig.message}`,
              {
                description: newAlert.message,
                duration: 10000,
              }
            );
          }

          // Invalidate alerts query
          queryClient.invalidateQueries({ queryKey: ['proposal-alerts', proposalId] });
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(alertsChannel);
    };
  }, [proposalId, queryClient, isRecentView]);

  // Cleanup old viewers (older than 2 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveViewers((prev) => prev.filter(v => isRecentView(v.viewedAt)));
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isRecentView]);

  return {
    activeViewers,
    isViewingNow: activeViewers.length > 0,
    lastViewerName,
  };
}
