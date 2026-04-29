import { useEffect, useRef, useState } from 'react';
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

function classifyPerformance(totalMs: number | null): 'good' | 'attention' | 'slow' {
  if (totalMs == null) return 'attention';
  if (totalMs < 2000) return 'good';
  if (totalMs <= 5000) return 'attention';
  return 'slow';
}

export function DynamicDashboardRuntimeGate({ legacyDashboard }: DynamicDashboardRuntimeGateProps) {
  const gateMountRef = useRef<number>(performance.now());
  const gate = useDynamicDashboardRuntimeGate();
  const { toast } = useToast();
  const allowedLoggedRef = useRef(false);
  const errorToastShownRef = useRef(false);
  const shellStartRef = useRef<number | null>(null);
  const gateLoadMsRef = useRef<number | null>(null);
  const [closerDataMs, setCloserDataMs] = useState<number | null>(null);
  const [paceMs, setPaceMs] = useState<number | null>(null);
  const [shellRenderMs, setShellRenderMs] = useState<number | null>(null);

  // Gate load time = quando o gate parou de carregar
  useEffect(() => {
    if (!gate.isLoading && gateLoadMsRef.current === null) {
      gateLoadMsRef.current = Math.round(performance.now() - gateMountRef.current);
    }
  }, [gate.isLoading]);

  // Shell start = quando decidimos renderizar dinâmico
  useEffect(() => {
    if (gate.shouldRenderDynamic && shellStartRef.current === null) {
      shellStartRef.current = performance.now();
      // Mede tempo até próximo paint para representar shell render
      requestAnimationFrame(() => {
        if (shellStartRef.current != null) {
          setShellRenderMs(Math.round(performance.now() - shellStartRef.current));
        }
      });
    }
  }, [gate.shouldRenderDynamic]);

  // Log runtime_allowed quando todas as fases conhecidas estão prontas, com timeout de 8s
  useEffect(() => {
    if (!gate.shouldRenderDynamic) return;
    if (allowedLoggedRef.current) return;
    if (!gate.tenantId || !gate.userId) return;

    const ready = closerDataMs != null && shellRenderMs != null;
    const timeoutMs = 8000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (allowedLoggedRef.current) return;
      allowedLoggedRef.current = true;
      const totalInteractive =
        closerDataMs != null && shellRenderMs != null
          ? (gateLoadMsRef.current ?? 0) + shellRenderMs + closerDataMs
          : null;
      const performanceStatus = classifyPerformance(totalInteractive);
      const meta: Record<string, any> = {
        sprint: '6.5',
        entrypoint: 'dashboard_home_gate',
        render_mode: 'dynamic_runtime',
        profile_key: gate.resolvedProfile?.key ?? null,
        guard_result: 'allowed',
        gate_load_ms: gateLoadMsRef.current,
        shell_render_ms: shellRenderMs,
        closer_data_load_ms: closerDataMs,
        pace_load_ms: paceMs,
        total_interactive_ms: totalInteractive,
        performance_status: performanceStatus,
        loaded_at: new Date().toISOString(),
      };
      logDynamicDashboardRuntimeEvent({
        tenantId: gate.tenantId!,
        userId: gate.userId!,
        eventType: 'runtime_allowed',
        profileKey: gate.resolvedProfile?.key ?? null,
        guardAllowed: true,
        loadMs: totalInteractive,
        metadata: meta,
      });
    };

    if (ready) {
      // pequeno delay para captar o último frame
      timer = setTimeout(flush, 50);
    } else {
      timer = setTimeout(flush, timeoutMs);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    gate.shouldRenderDynamic,
    gate.tenantId,
    gate.userId,
    gate.resolvedProfile,
    closerDataMs,
    paceMs,
    shellRenderMs,
  ]);

  if (gate.isLoading) {
    return <GateSkeleton />;
  }

  if (!gate.shouldRenderDynamic) {
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
          sprint: '6.5',
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
          onCloserDataReady={(ms) => {
            if (closerDataMs == null) setCloserDataMs(ms);
          }}
          onCloserPaceReady={(ms) => {
            if (paceMs == null) setPaceMs(ms);
          }}
        />
      </div>
    </RuntimeErrorBoundary>
  );
}
