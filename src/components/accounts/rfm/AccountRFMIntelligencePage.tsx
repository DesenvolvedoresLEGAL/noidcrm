import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccountRFMIntelligence, useRecalculateAccountRFM } from '@/hooks/useAccountRFMIntelligence';
import type { RFMSegment } from '@/services/crm/account-rfm';
import { RFMFilterBar } from './RFMFilterBar';
import { RFMOverviewCards } from './RFMOverviewCards';
import { RFMSegmentationCards } from './RFMSegmentationCards';
import { RFMAccountsTable } from './RFMAccountsTable';
import { RFMRecommendedActions } from './RFMRecommendedActions';
import { RFMScoreExplanationCard } from './RFMScoreExplanationCard';

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export function AccountRFMIntelligencePage() {
  const { organization, isAdmin, isOwner } = useCurrentOrganization();
  const { isAdmin: hasAdminRole } = useUserRole();
  const canRecalculate = !!(isAdmin || isOwner || hasAdminRole);

  const [periodEnd, setPeriodEnd] = useState(toISODate(new Date()));
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    return toISODate(d);
  });
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [segment, setSegment] = useState<RFMSegment | null>(null);
  const [search, setSearch] = useState('');

  const params = useMemo(() => {
    if (!organization?.id) return null;
    return {
      organizationId: organization.id,
      periodStart,
      periodEnd,
      ownerId,
      segment,
      search: search.trim() || null,
    };
  }, [organization?.id, periodStart, periodEnd, ownerId, segment, search]);

  const { data, isLoading, error } = useAccountRFMIntelligence(params);
  const recalc = useRecalculateAccountRFM();

  const handleRecalc = () => {
    if (!organization?.id) return;
    recalc.mutate({ organizationId: organization.id, periodStart, periodEnd });
  };

  return (
    <div className="space-y-6">
      <RFMScoreExplanationCard />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex-1 min-w-[300px]">
              <RFMFilterBar
                periodStart={periodStart}
                periodEnd={periodEnd}
                ownerId={ownerId}
                segment={segment}
                search={search}
                onChange={(n) => {
                  if (n.periodStart !== undefined) setPeriodStart(n.periodStart);
                  if (n.periodEnd !== undefined) setPeriodEnd(n.periodEnd);
                  if (n.ownerId !== undefined) setOwnerId(n.ownerId);
                  if (n.segment !== undefined) setSegment(n.segment);
                  if (n.search !== undefined) setSearch(n.search);
                }}
              />
            </div>
            {canRecalculate && (
              <Button onClick={handleRecalc} disabled={recalc.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${recalc.isPending ? 'animate-spin' : ''}`} />
                Recalcular RFM
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Erro ao carregar RFM: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <RFMOverviewCards overview={data?.overview} />
          <RFMSegmentationCards
            segments={data?.segments}
            onSegmentClick={(s) => setSegment((cur) => (cur === s ? null : s))}
          />
          <RFMAccountsTable accounts={data?.accounts} />
          <RFMRecommendedActions actions={data?.recommended_actions} />
        </>
      )}
    </div>
  );
}
