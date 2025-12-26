import { motion } from 'framer-motion';
import { useTeamPerformanceScores, useAtRiskSellers } from '@/hooks/usePerformanceScores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertTriangle, TrendingUp, Medal, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { getScoreColor, getCoachingSuggestions } from '@/services/performance/performanceScores';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function ManagerPerformanceDashboard() {
  const [sortBy, setSortBy] = useState<'ras' | 'cs' | 'bs' | 'ds'>('ras');
  const { teamScores, teamAverages, isLoading } = useTeamPerformanceScores();
  const { data: atRiskSellers = [] } = useAtRiskSellers();

  const sortedScores = [...teamScores].sort((a, b) => {
    const key = `${sortBy}_final` as keyof typeof a;
    return ((b[key] as number) || 0) - ((a[key] as number) || 0);
  });

  if (isLoading) {
    return <ManagerDashboardSkeleton />;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-4 md:p-6 space-y-6">
      <DashboardHeader role="manager" title="Performance do Time" subtitle="Visão geral e alertas" />

      {/* Team Averages */}
      <motion.div variants={sectionVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'CS Médio', value: teamAverages.cs, color: getScoreColor(teamAverages.cs) },
          { label: 'BS Médio', value: teamAverages.bs, color: getScoreColor(teamAverages.bs) },
          { label: 'DS Médio', value: teamAverages.ds, color: getScoreColor(teamAverages.ds) },
          { label: 'RAS Médio', value: teamAverages.ras, color: getScoreColor(teamAverages.ras) },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={cn('text-3xl font-bold', item.color)}>{item.value.toFixed(1)}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* At Risk Sellers */}
      {atRiskSellers.length > 0 && (
        <motion.div variants={sectionVariants}>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Vendedores em Risco ({atRiskSellers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {atRiskSellers.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={s.seller?.avatar_url} />
                        <AvatarFallback>{s.seller?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{s.seller?.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className={getScoreColor(s.cs_final)}>CS: {s.cs_final?.toFixed(0)}</Badge>
                      <Badge variant="outline" className={getScoreColor(s.bs_final)}>BS: {s.bs_final?.toFixed(0)}</Badge>
                      <Badge variant="outline" className={getScoreColor(s.ds_final)}>DS: {s.ds_final?.toFixed(0)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ranking */}
      <motion.div variants={sectionVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-primary" />
              Ranking do Time
            </CardTitle>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ras">RAS</SelectItem>
                <SelectItem value="cs">CS</SelectItem>
                <SelectItem value="bs">BS</SelectItem>
                <SelectItem value="ds">DS</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedScores.slice(0, 10).map((s, idx) => (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50">
                  <span className={cn('w-6 text-center font-bold', idx < 3 && 'text-primary')}>{idx + 1}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(s as any).seller?.avatar_url} />
                    <AvatarFallback>{(s as any).seller?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium">{(s as any).seller?.name}</span>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <span className={getScoreColor(s.cs_final)}>CS: {s.cs_final?.toFixed(0)}</span>
                    <span className={getScoreColor(s.bs_final)}>BS: {s.bs_final?.toFixed(0)}</span>
                    <span className={getScoreColor(s.ds_final)}>DS: {s.ds_final?.toFixed(0)}</span>
                    <span className={cn('font-bold', getScoreColor(s.ras_final))}>RAS: {s.ras_final?.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-48" />
    </div>
  );
}

// Export aliases for admin/owner
export const AdminPerformanceDashboard = ManagerPerformanceDashboard;
export const OwnerPerformanceDashboard = ManagerPerformanceDashboard;
