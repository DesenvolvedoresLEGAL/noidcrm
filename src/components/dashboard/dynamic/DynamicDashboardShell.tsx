import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  useDynamicDashboardShell,
  type ShellMode,
} from '@/hooks/dashboard/useDynamicDashboardShell';
import type {
  DashboardProfile,
  DashboardResolutionResult,
  ResolvedDashboardProfile,
} from '@/services/crm/dashboardProfiles';
import { cn } from '@/lib/utils';
import { DynamicDashboardHeader } from './DynamicDashboardHeader';
import { DynamicDashboardGrid } from './DynamicDashboardGrid';
import { DynamicDashboardState } from './DynamicDashboardState';
import { CloserDashboard } from '@/components/dashboard/closer/CloserDashboard';

export type DynamicDashboardShellProps = {
  profile: DashboardProfile | ResolvedDashboardProfile | null;
  resolution?: DashboardResolutionResult | null;
  mode?: ShellMode;
  loading?: boolean;
  error?: Error | null;
  className?: string;
  tenantId?: string;
  targetUserId?: string;
};

export function DynamicDashboardShell({
  profile,
  resolution = null,
  mode = 'preview',
  loading = false,
  error = null,
  className,
}: DynamicDashboardShellProps) {
  const shell = useDynamicDashboardShell(profile, { mode, resolution });

  if (loading) {
    return <DynamicDashboardState state="loading" />;
  }
  if (error) {
    return <DynamicDashboardState state="error" detail={error.message} />;
  }
  if (!profile) {
    return <DynamicDashboardState state="empty" />;
  }

  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="p-4 md:p-5 space-y-4">
        <DynamicDashboardHeader shell={shell} />

        {shell.isLegacy && <DynamicDashboardState state="legacy" />}
        {shell.isUnsupported && <DynamicDashboardState state="unsupported" />}

        {shell.isPlaceholder && (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Este shell ainda não exibe dados reais. Os widgets abaixo são placeholders
                vindos do JSON do profile e não substituem o dashboard atual do CRM.
              </AlertDescription>
            </Alert>
            <DynamicDashboardGrid widgets={shell.widgets} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
