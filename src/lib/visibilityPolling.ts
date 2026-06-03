// SPRINT PERF 0.6B — Helper for tab-visibility-aware polling.
// Returns `false` for refetchInterval when the tab is hidden so that
// React Query pauses background polling. When the tab becomes visible
// again, the optional `onVisible` callback fires once so the consumer
// can trigger an immediate refetch. Safe for non-critical polls only.

import { useEffect, useState } from 'react';

export function useVisibilityAwareInterval(
  baseMs: number,
  opts?: { enabled?: boolean; onVisible?: () => void },
): number | false {
  const enabled = opts?.enabled ?? true;
  const [hidden, setHidden] = useState<boolean>(
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      const h = document.hidden;
      setHidden(h);
      if (!h) opts?.onVisible?.();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return false;
  return hidden ? false : baseMs;
}
