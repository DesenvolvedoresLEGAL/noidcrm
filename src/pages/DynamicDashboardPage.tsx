import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDynamicDashboardGuard } from '@/hooks/dashboard/useDynamicDashboardGuard';
import { DynamicDashboardShell } from '@/components/dashboard/dynamic/DynamicDashboardShell';
import { DynamicDashboardSafeBanner } from '@/components/dashboard/dynamic/DynamicDashboardSafeBanner';
import { DynamicDashboardFallback } from '@/components/dashboard/dynamic/DynamicDashboardFallback';
import { logCloserDashboardView } from '@/services/crm/closerDashboardAudit';

export default function DynamicDashboardPage() {
  const { user, organization, loading } = useCurrentUser();
  const tenantId = organization?.id ?? null;
  const userId = user?.id ?? null;

  const guard = useDynamicDashboardGuard(tenantId, userId);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!guard.data?.allowed || !tenantId || !userId) return;
    if (loggedRef.current) return;
    loggedRef.current = true;
    logCloserDashboardView({
      tenantId,
      targetUserId: userId,
      source: 'runtime',
      period: 'current_month',
      metadata: { route: '/app/dynamic-dashboard' },
    });
  }, [guard.data?.allowed, tenantId, userId]);

  if (loading || guard.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenantId || !userId) {
    return <DynamicDashboardFallback reason="no_tenant" />;
  }

  if (!guard.data?.allowed) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4">
        <DynamicDashboardFallback reason={guard.data?.reason} />
      </div>
    );
  }

  const profile = guard.data.resolution?.resolved_profile ?? null;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4">
      <DynamicDashboardSafeBanner />
      <DynamicDashboardShell
        profile={profile as any}
        resolution={guard.data.resolution}
        mode="runtime"
        tenantId={tenantId}
        targetUserId={userId}
      />
    </div>
  );
}
