import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyVibeCheck } from '@/hooks/useDailyVibeCheck';
import { useActiveVibeAlertsCount } from '@/hooks/useVibeAlerts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Flame, AlertTriangle, Bell, TrendingUp } from 'lucide-react';

export function VibeQuickStats() {
  const { profile } = useCurrentUser();
  const { data, isLoading: isLoadingVibe } = useDailyVibeCheck();
  const { data: alertsCount, isLoading: isLoadingAlerts } = useActiveVibeAlertsCount(profile?.id || '');

  const isLoading = isLoadingVibe || isLoadingAlerts;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Total de Deals',
      value: data?.totalDeals || 0,
      icon: TrendingUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Deals Quentes',
      value: data?.hottestLead ? 1 + (data?.nudgeOpportunities?.length || 0) : 0,
      icon: Flame,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      label: 'Requer Atenção',
      value: data?.requiresAttention || 0,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      label: 'Alertas Ativos',
      value: alertsCount || 0,
      icon: Bell,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Estatísticas Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.map((stat) => (
          <div 
            key={stat.label} 
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <span className="text-sm font-medium">{stat.label}</span>
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
