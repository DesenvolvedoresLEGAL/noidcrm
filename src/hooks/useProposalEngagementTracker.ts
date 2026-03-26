import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EngagementTrackerOptions {
  proposalId: string;
  enabled?: boolean;
  heartbeatIntervalMs?: number;
}

interface InteractionCounts {
  clicks: number;
  copies: number;
  pdfDownloads: number;
  prints: number;
}

export function useProposalEngagementTracker({
  proposalId,
  enabled = true,
  heartbeatIntervalMs = 30000,
}: EngagementTrackerOptions) {
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const startTimeRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const sectionsViewedRef = useRef<Set<string>>(new Set());
  const sectionTimersRef = useRef<Record<string, number>>({});
  const sectionEnterTimesRef = useRef<Record<string, number>>({});
  const interactionsRef = useRef<InteractionCounts>({ clicks: 0, copies: 0, pdfDownloads: 0, prints: 0 });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getMetadata = useCallback(() => {
    // Finalize any currently-visible section times
    const now = Date.now();
    const timePerSection = { ...sectionTimersRef.current };
    for (const [section, enterTime] of Object.entries(sectionEnterTimesRef.current)) {
      timePerSection[section] = (timePerSection[section] || 0) + Math.round((now - enterTime) / 1000);
    }

    return {
      sessionId: sessionIdRef.current,
      durationSeconds: Math.round((now - startTimeRef.current) / 1000),
      scrollDepthPercent: Math.round(maxScrollDepthRef.current),
      sectionsViewed: Array.from(sectionsViewedRef.current),
      timePerSection,
      interactions: { ...interactionsRef.current },
    };
  }, []);

  const sendUpdate = useCallback(async () => {
    if (!proposalId) return;
    try {
      await supabase.functions.invoke('track-proposal-view', {
        body: {
          proposalId,
          action: 'update_view',
          metadata: getMetadata(),
        },
      });
    } catch (err) {
      console.error('[EngagementTracker] heartbeat error:', err);
    }
  }, [proposalId, getMetadata]);

  const sendBeacon = useCallback(() => {
    if (!proposalId) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-proposal-view`;
    const body = JSON.stringify({
      proposalId,
      action: 'update_view',
      metadata: getMetadata(),
    });
    
    const sent = navigator.sendBeacon?.(
      url,
      new Blob([body], { type: 'application/json' })
    );
    
    if (!sent) {
      // Fallback: fire-and-forget fetch
      fetch(url, {
        method: 'POST',
        body,
        headers: { 
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        keepalive: true,
      }).catch(() => {});
    }
  }, [proposalId, getMetadata]);

  // Track interactions
  const trackPdfDownload = useCallback(() => {
    interactionsRef.current.pdfDownloads += 1;
  }, []);

  const trackCopy = useCallback(() => {
    interactionsRef.current.copies += 1;
  }, []);

  const trackPrint = useCallback(() => {
    interactionsRef.current.prints += 1;
  }, []);

  useEffect(() => {
    if (!enabled || !proposalId) return;

    // --- Scroll tracking ---
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const depth = (window.scrollY / scrollHeight) * 100;
        if (depth > maxScrollDepthRef.current) {
          maxScrollDepthRef.current = depth;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // --- Click tracking ---
    const handleClick = () => {
      interactionsRef.current.clicks += 1;
    };
    document.addEventListener('click', handleClick);

    // --- Copy tracking ---
    const handleCopy = () => {
      interactionsRef.current.copies += 1;
    };
    document.addEventListener('copy', handleCopy);

    // --- Print tracking ---
    const handleBeforePrint = () => {
      interactionsRef.current.prints += 1;
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    // --- IntersectionObserver for sections ---
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        entries.forEach((entry) => {
          const sectionName = (entry.target as HTMLElement).dataset.section;
          if (!sectionName) return;

          if (entry.isIntersecting) {
            sectionsViewedRef.current.add(sectionName);
            sectionEnterTimesRef.current[sectionName] = now;
          } else if (sectionEnterTimesRef.current[sectionName]) {
            const elapsed = Math.round((now - sectionEnterTimesRef.current[sectionName]) / 1000);
            sectionTimersRef.current[sectionName] = (sectionTimersRef.current[sectionName] || 0) + elapsed;
            delete sectionEnterTimesRef.current[sectionName];
          }
        });
      },
      { threshold: 0.3 }
    );

    // Observe sections after a short delay to let DOM render
    const observeTimeout = setTimeout(() => {
      document.querySelectorAll('[data-section]').forEach((el) => {
        observerRef.current?.observe(el);
      });
    }, 1000);

    // --- Heartbeat ---
    heartbeatRef.current = setInterval(sendUpdate, heartbeatIntervalMs);

    // --- Page unload / visibility change ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendBeacon();
      }
    };
    const handleBeforeUnload = () => {
      sendBeacon();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('beforeprint', handleBeforePrint);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(observeTimeout);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      observerRef.current?.disconnect();
      // Send final update on unmount
      sendUpdate();
    };
  }, [enabled, proposalId, heartbeatIntervalMs, sendUpdate, sendBeacon]);

  return {
    sessionId: sessionIdRef.current,
    trackPdfDownload,
    trackCopy,
    trackPrint,
  };
}
