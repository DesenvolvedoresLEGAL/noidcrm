import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCelebrationSettings } from '@/hooks/useCelebrationSettings';
import { DealWonCelebrationModal } from '@/components/notifications/DealWonCelebrationModal';
import type { CelebrationMetadata, CelebrationNotification } from '@/types/celebration';
import confetti from 'canvas-confetti';

const CELEBRATION_TYPES = ['deal_won', 'team_deal_won', 'new_contract', 'new_onboarding'];

type NotificationV2Row = Database['public']['Tables']['notifications_v2']['Row'];

interface CelebrationProviderProps {
  children: ReactNode;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function getBooleanField(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function parseOpportunityIdFromActionUrl(actionUrl: string | null): string | undefined {
  if (!actionUrl) return undefined;
  const match = actionUrl.match(/\/app\/opportunities\/([a-f0-9-]{36})/i);
  return match?.[1];
}

function buildCelebrationMetadata(params: {
  payload: Json | null;
  row: NotificationV2Row;
}): CelebrationMetadata {
  const { payload, row } = params;
  const source = isObjectRecord(payload) ? payload : {};

  return {
    proposal_id: getStringField(source, 'proposal_id'),
    opportunity_id:
      getStringField(source, 'opportunity_id') ?? parseOpportunityIdFromActionUrl(row.action_url),
    cs_opportunity_id: getStringField(source, 'cs_opportunity_id'),
    contract_id: getStringField(source, 'contract_id'),
    acceptor_name: getStringField(source, 'acceptor_name'),
    seller_name: getStringField(source, 'seller_name'),
    value: getNumberField(source, 'value'),
    account_name: getStringField(source, 'account_name') ?? getStringField(source, 'company_name'),
    role: getStringField(source, 'role'),
    primary_color: getStringField(source, 'primary_color'),
    show_celebration: getBooleanField(source, 'show_celebration'),
  };
}

export function CelebrationProvider({ children }: CelebrationProviderProps) {
  const { user } = useSupabaseAuth();
  const [celebrationNotification, setCelebrationNotification] = useState<CelebrationNotification | null>(null);

  const {
    enabled,
    soundEnabled,
    playCelebrationSound,
    getParticleCount,
    animationDuration,
  } = useCelebrationSettings();

  const triggerConfetti = useCallback(() => {
    const duration = animationDuration;
    const particles = getParticleCount();
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = particles * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
    }, 250);

    setTimeout(() => clearInterval(interval), duration + 100);
  }, [animationDuration, getParticleCount]);

  const handlerRef = useRef<(notification: CelebrationNotification) => void>(() => {});
  handlerRef.current = (notification: CelebrationNotification) => {
    if (enabled) triggerConfetti();
    if (soundEnabled) playCelebrationSound();
    setCelebrationNotification(notification);
  };

  const celebratedIdsRef = useRef<Set<string>>(new Set());

  const handleRealtimeCelebration = useCallback(async (row: NotificationV2Row) => {
    if (!CELEBRATION_TYPES.includes(row.type)) return;
    if (celebratedIdsRef.current.has(row.id)) return;
    celebratedIdsRef.current.add(row.id);

    let payload: Json | null = null;

    if (row.event_id) {
      const { data, error } = await supabase
        .from('notification_events')
        .select('payload')
        .eq('id', row.event_id)
        .maybeSingle();

      if (error) {
        console.warn('[celebration-provider] failed to load notification event payload', {
          notification_id: row.id,
          event_id: row.event_id,
          error,
        });
      }

      payload = data?.payload ?? null;
    }

    const metadata = buildCelebrationMetadata({ payload, row });
    if (metadata.show_celebration === false) return;

    handlerRef.current({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      metadata,
    });
  }, []);

  // Realtime subscription for new celebrations
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`celebrations-v2-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_v2',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationV2Row;
          void handleRealtimeCelebration(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeCelebration, user?.id]);

  // Replay: on mount, check for unread celebrations from last 10 min
  // (covers cases where user wasn't connected when realtime INSERT fired)
  useEffect(() => {
    if (!user?.id) return;

    const replayCelebrations = async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('notifications_v2')
        .select('*')
        .eq('user_id', user.id)
        .in('type', CELEBRATION_TYPES)
        .is('read_at', null)
        .gte('created_at', tenMinAgo)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.warn('[celebration-provider] replay query failed', error);
        return;
      }

      if (data && data.length > 0) {
        // Trigger only the most recent one to avoid stacking modals
        const mostRecent = data[0] as NotificationV2Row;
        void handleRealtimeCelebration(mostRecent);
      }
    };

    void replayCelebrations();
  }, [handleRealtimeCelebration, user?.id]);

  const dismissCelebration = useCallback(() => {
    setCelebrationNotification(null);
  }, []);

  return (
    <>
      {children}
      <DealWonCelebrationModal
        notification={celebrationNotification}
        open={!!celebrationNotification}
        onClose={dismissCelebration}
      />
    </>
  );
}
