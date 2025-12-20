import { motion } from "framer-motion";
import { MissionsCard } from "@/components/gamification/MissionsCard";
import { BadgeShowcase } from "@/components/gamification/BadgeShowcase";
import { LeaderboardCard } from "@/components/gamification/LeaderboardCard";
import { Badge } from "@/services/gamification/badges";

interface GamificationSectionProps {
  sellerId?: string;
  badges: Badge[];
  badgesByCategory: Record<string, Badge[]>;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  },
};

export function GamificationSection({ sellerId, badges, badgesByCategory }: GamificationSectionProps) {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Missions */}
        <MissionsCard sellerId={sellerId} />
        
        {/* Leaderboard */}
        <LeaderboardCard currentSellerId={sellerId} />
      </div>

      {/* Badges */}
      <BadgeShowcase 
        badges={badges} 
        badgesByCategory={badgesByCategory}
      />
    </motion.div>
  );
}
