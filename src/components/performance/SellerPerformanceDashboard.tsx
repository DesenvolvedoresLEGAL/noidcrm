import { motion } from 'framer-motion';
import { useSellerPerformanceScores, usePerformanceHistory, useDynamicMissions } from '@/hooks/usePerformanceScores';
import { useGamification } from '@/hooks/useGamification';
import { useMissions } from '@/hooks/useMissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PerformanceScoreCard } from './PerformanceScoreCard';
import { PerformanceEvolutionChart } from './PerformanceEvolutionChart';
import { PerformanceBreakdown } from './PerformanceBreakdown';
import { DynamicMissionsCard } from './DynamicMissionsCard';
import { NextActionCard } from './NextActionCard';
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function SellerPerformanceDashboard() {
  const { profile } = useCurrentUser();
  const sellerId = profile?.seller_id;
  
  const { scores, breakdowns, isLoading: loadingScores } = useSellerPerformanceScores(sellerId);
  const { data: history, isLoading: loadingHistory } = usePerformanceHistory(sellerId, 30);
  const { missions, isLoading: loadingMissions, generateMissions, isGenerating } = useDynamicMissions(sellerId);

  if (loadingScores) {
    return <SellerDashboardSkeleton />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 space-y-6"
    >
      <DashboardHeader
        role="sales"
        title="Minha Performance"
        subtitle="Acompanhe seus scores e evolução"
        icon={<Gauge className="h-6 w-6" />}
      />

      {/* Score Cards */}
      <motion.div variants={sectionVariants}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {breakdowns.map(breakdown => (
            <PerformanceScoreCard key={breakdown.score} breakdown={breakdown} showDetails />
          ))}
        </div>
      </motion.div>

      {/* Next Action */}
      <motion.div variants={sectionVariants}>
        <NextActionCard breakdowns={breakdowns} rasStatus={scores?.ras_status} />
      </motion.div>

      {/* Evolution Chart */}
      <motion.div variants={sectionVariants}>
        <PerformanceEvolutionChart data={history || []} isLoading={loadingHistory} />
      </motion.div>

      {/* Breakdown */}
      <motion.div variants={sectionVariants}>
        <PerformanceBreakdown breakdowns={breakdowns} />
      </motion.div>

      {/* Missions */}
      <motion.div variants={sectionVariants} className="grid md:grid-cols-2 gap-4">
        <DynamicMissionsCard 
          missions={missions} 
          isLoading={loadingMissions}
          onGenerateMissions={generateMissions}
          isGenerating={isGenerating}
        />
        <MissionsCard sellerId={sellerId} />
      </motion.div>
    </motion.div>
  );
}

function SellerDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}
