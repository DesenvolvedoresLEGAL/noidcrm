import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import {
  useDynamicDashboardGuard,
  type DynamicDashboardGuardResult,
  type GuardDenyReason,
} from './useDynamicDashboardGuard';
import { logDynamicDashboardRuntimeEvent } from '@/services/crm/dynamicDashboardRuntimeLogs';

const SESSION_KEY = 'noid_use_legacy_dashboard_session';

function readSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSessionFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, 'true');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export interface RuntimeGateState {
  isLoading: boolean;
  shouldRenderDynamic: boolean;
  fallbackReason: GuardDenyReason | 'session_legacy' | null;
  resolvedProfile: any;
  resolution: DynamicDashboardGuardResult['resolution'];
  context: DynamicDashboardGuardResult['context'] | null;
  flags: { global: boolean; user: boolean };
  error: unknown;
  isPilotEligible: boolean;
  useLegacyForSession: boolean;
  setUseLegacyForSession: (value: boolean) => void;
  refresh: () => void;
  tenantId: string | null;
  userId: string | null;
}

export function useDynamicDashboardRuntimeGate(): RuntimeGateState {
  const { user, organization, loading: userLoading } = useCurrentUser();
  const tenantId = organization?.id ?? null;
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const [useLegacyForSession, setUseLegacyForSessionState] = useState<boolean>(() =>
    readSessionFlag(),
  );

  const guard = useDynamicDashboardGuard(tenantId, userId);

  // requires_review check
  const reviewQ = useQuery({
    queryKey: ['runtime-gate', 'review', tenantId, userId],
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_user_contexts' as any)
        .select('metadata')
        .eq('tenant_id', tenantId as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      return { requiresReview: !!(data as any)?.metadata?.requires_review };
    },
  });

  const isLoading = userLoading || guard.isLoading || reviewQ.isLoading;
  const requiresReview = !!reviewQ.data?.requiresReview;

  const isPilotEligible =
    !!guard.data?.allowed &&
    guard.data?.context.businessFunctionKey === 'closer' &&
    !requiresReview;

  let fallbackReason: RuntimeGateState['fallbackReason'] = null;
  if (!isLoading) {
    if (!guard.data?.allowed) {
      fallbackReason = guard.data?.reason ?? 'no_tenant';
    } else if (requiresReview) {
      fallbackReason = 'user_flag_off';
    } else if (useLegacyForSession) {
      fallbackReason = 'session_legacy';
    }
  }

  const shouldRenderDynamic = isPilotEligible && !useLegacyForSession;

  const setUseLegacyForSession = useCallback(
    (value: boolean) => {
      writeSessionFlag(value);
      setUseLegacyForSessionState(value);
      if (tenantId && userId) {
        logDynamicDashboardRuntimeEvent({
          tenantId,
          userId,
          eventType: value ? 'user_chose_legacy_dashboard' : 'user_returned_to_dynamic_dashboard',
          profileKey: guard.data?.resolution?.resolved_profile?.key ?? null,
          guardAllowed: !!guard.data?.allowed,
          metadata: {
            sprint: '6.4',
            entrypoint: value ? 'dynamic_runtime_button' : 'legacy_session_banner',
          },
        });
      }
      // bust queries that depend on this
      queryClient.invalidateQueries({ queryKey: ['dynamic-dashboard-guard'] });
    },
    [tenantId, userId, guard.data, queryClient],
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dynamic-dashboard-guard'] });
    queryClient.invalidateQueries({ queryKey: ['runtime-gate'] });
  }, [queryClient]);

  // Log fallback (non-session) once per resolved state — best-effort fire-and-forget
  useEffect(() => {
    if (isLoading) return;
    if (!tenantId || !userId) return;
    if (shouldRenderDynamic) return;
    if (fallbackReason === 'session_legacy') return; // user choice already logged
    if (!fallbackReason) return;
    // Only log when guard finished and we are showing legacy via fallback
    logDynamicDashboardRuntimeEvent({
      tenantId,
      userId,
      eventType: 'runtime_fallback',
      profileKey: guard.data?.resolution?.resolved_profile?.key ?? null,
      guardAllowed: !!guard.data?.allowed,
      fallbackUsed: true,
      fallbackReason,
      metadata: {
        sprint: '6.4',
        entrypoint: 'dashboard_home_gate',
        business_function_key: guard.data?.context?.businessFunctionKey ?? null,
        global_flag: !!guard.data?.context?.isGlobalDynamicEnabled,
        user_flag: !!guard.data?.context?.isUserDynamicEnabled,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, shouldRenderDynamic, fallbackReason, tenantId, userId]);

  return {
    isLoading,
    shouldRenderDynamic,
    fallbackReason,
    resolvedProfile: guard.data?.resolution?.resolved_profile ?? null,
    resolution: guard.data?.resolution ?? null,
    context: guard.data?.context ?? null,
    flags: {
      global: !!guard.data?.context?.isGlobalDynamicEnabled,
      user: !!guard.data?.context?.isUserDynamicEnabled,
    },
    error: guard.error,
    isPilotEligible,
    useLegacyForSession,
    setUseLegacyForSession,
    refresh,
    tenantId,
    userId,
  };
}
