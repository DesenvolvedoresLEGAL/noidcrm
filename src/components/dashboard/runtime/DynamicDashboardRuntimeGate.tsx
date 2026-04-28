import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useDynamicDashboardRuntimeGate } from '@/hooks/dashboard/useDynamicDashboardRuntimeGate';
import { DynamicDashboardShell } from '@/components/dashboard/dynamic/DynamicDashboardShell';
import { RuntimeErrorBoundary } from './RuntimeErrorBoundary';
import { RuntimeGateSafeBanner } from './RuntimeGateSafeBanner';
import { LegacySessionReturnBanner } from './LegacySessionReturnBanner';
import { logDynamicDashboardRuntimeEvent } from '@/services/crm/dynamicDashboardRuntimeLogs';

export interface DynamicDashboardRuntimeGateProps {
  legacyDashboard: React.ReactNode;
}

function GateSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function DynamicDashboardRuntimeGate({ legacyDashboard }: DynamicDashboardRuntimeGateProps) {
  const gate = useDynamicDashboardRuntimeGate();
  const { toast } = useToast();
  const allowedLoggedRef = useRef(false);
  const errorToastShownRef = useRef(false);
  const loadStartRef = useRef<number | null>(null);

  // Mark load start when we decide to render dynamic
  useEffect(() => {
    if (gate.shouldRenderDynamic && loadStartRef.current === null) {
      loadStartRef.current = performance.now();
    }
  }, [gate.shouldRenderDynamic]);

  // Log runtime_allowed once per pilot session render
  useEffect(() => {
    if (!gate.shouldRenderDynamic) return;
    if (allowedLoggedRef.current) return;
    if (!gate.tenantId || !gate.userId) return;
    allowedLoggedRef.current = true;
    const startedAt = loadStartRef.current ?? performance.now();
    // Defer slightly so first paint roughly captured
    const handle = setTimeout(() => {
      const loadMs = Math.max(0, Math.round(performance.now() - startedAt));
      const meta: Record<string, any> = {
        sprint: '6.4',
        entrypoint: 'dashboard_home_gate',
        render_mode: 'dynamic_runtime',
        profile_key: gate.resolvedProfile?.key ?? null,
        guard_result: 'allowed',
        load_started_at: new Date(Date.now() - loadMs).toISOString(),
        loaded_at: new Date().toISOString(),
      };
      if (loadMs > 5000) meta.warning = 'slow_load';
      logDynamicDashboardRuntimeEvent({
        tenantId: gate.tenantId!,
        userId: gate.userId!,
        eventType: 'runtime_allowed',
        profileKey: gate.resolvedProfile?.key ?? null,
        guardAllowed: true,
        loadMs,
        metadata: meta,
      });
    }, 50);
    return () => clearTimeout(handle);
  }, [gate.shouldRenderDynamic, gate.tenantId, gate.userId, gate.resolvedProfile]);

  if (gate.isLoading) {
    return <GateSkeleton />;
  }

  if (!gate.shouldRenderDynamic) {
    // Legacy path. Show return banner for pilots who chose legacy this session.
    return (
      <>
        <LegacySessionReturnBanner />
        {legacyDashboard}
      </>
    );
  }

  const handleError = (error: Error) => {
    if (gate.tenantId && gate.userId) {
      logDynamicDashboardRuntimeEvent({
        tenantId: gate.tenantId,
        userId: gate.userId,
        eventType: 'runtime_error',
        profileKey: gate.resolvedProfile?.key ?? null,
        guardAllowed: true,
        fallbackUsed: true,
        fallbackReason: 'runtime_exception',
        errorMessage: error?.message ?? 'unknown_error',
        metadata: {
          sprint: '6.4',
          entrypoint: 'dashboard_home_gate',
          render_mode: 'dynamic_runtime',
        },
      });
    }
    if (!errorToastShownRef.current) {
      errorToastShownRef.current = true;
      toast({
        title: 'Não foi possível carregar o novo dashboard',
        description: 'Abrimos o dashboard atual para manter sua operação.',
        variant: 'default',
      });
    }
  };

  return (
    <RuntimeErrorBoundary fallback={<>{legacyDashboard}</>} onError={handleError}>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4">
        <RuntimeGateSafeBanner />
        <DynamicDashboardShell
          profile={gate.resolvedProfile as any}
          resolution={gate.resolution}
          mode="runtime"
          tenantId={gate.tenantId!}
          targetUserId={gate.userId!}
        />
      </div>
    </RuntimeErrorBoundary>
  );
}
