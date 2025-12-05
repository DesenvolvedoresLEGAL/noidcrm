import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Gift, 
  LogIn, 
  MessageSquare, 
  CalendarPlus, 
  FileText,
  Trophy,
  Award,
  CalendarCheck,
  TrendingUp,
  Flame,
  Target,
  Sparkles
} from 'lucide-react';
import { SellerMission } from '@/services/gamification/missions';
import confetti from 'canvas-confetti';

interface MissionItemProps {
  mission: SellerMission;
  onClaim: (missionId: string) => Promise<void>;
  isClaiming: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  'log-in': LogIn,
  'message-square': MessageSquare,
  'check-circle': CheckCircle,
  'calendar-plus': CalendarPlus,
  'file-text': FileText,
  'trophy': Trophy,
  'award': Award,
  'calendar-check': CalendarCheck,
  'trending-up': TrendingUp,
  'flame': Flame,
  'target': Target,
};

export function MissionItem({ mission, onClaim, isClaiming }: MissionItemProps) {
  const [showClaimAnimation, setShowClaimAnimation] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  const missionData = mission.mission;
  if (!missionData) return null;

  const Icon = iconMap[missionData.icon] || Target;
  const progress = Math.min((mission.current_progress / missionData.target_value) * 100, 100);
  const isCompleted = mission.completed;
  const isClaimed = mission.claimed;

  const handleClaim = async () => {
    setXpEarned(missionData.xp_reward);
    setShowClaimAnimation(true);
    
    // Trigger confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });

    await onClaim(mission.mission_id);

    setTimeout(() => {
      setShowClaimAnimation(false);
    }, 2000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'roleplay': return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
      case 'crm': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      case 'engagement': return 'bg-green-500/20 text-green-600 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-4 rounded-lg border transition-all ${
        isClaimed 
          ? 'bg-muted/30 border-muted opacity-60' 
          : isCompleted 
            ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20' 
            : 'bg-card border-border hover:border-primary/30'
      }`}
    >
      <AnimatePresence>
        {showClaimAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -30 }}
            exit={{ opacity: 0, y: -60 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
          >
            <div className="flex items-center gap-1 text-yellow-500 font-bold text-lg">
              <Sparkles className="h-5 w-5" />
              +{xpEarned} XP
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          isClaimed ? 'bg-muted' : isCompleted ? 'bg-primary/20' : 'bg-muted'
        }`}>
          <Icon className={`h-5 w-5 ${
            isClaimed ? 'text-muted-foreground' : isCompleted ? 'text-primary' : 'text-muted-foreground'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-medium text-sm ${isClaimed ? 'text-muted-foreground' : ''}`}>
              {missionData.name}
            </h4>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(missionData.category)}`}>
              {missionData.category === 'roleplay' ? 'Treino' : 
               missionData.category === 'crm' ? 'CRM' : 'Engajamento'}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">
            {missionData.description}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
            <span className="text-xs font-medium whitespace-nowrap">
              {mission.current_progress}/{missionData.target_value}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            +{missionData.xp_reward} XP
          </Badge>

          {isCompleted && !isClaimed && (
            <Button
              size="sm"
              onClick={handleClaim}
              disabled={isClaiming}
              className="gap-1 text-xs h-7"
            >
              <Gift className="h-3 w-3" />
              Coletar
            </Button>
          )}

          {isClaimed && (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle className="h-3 w-3" />
              Coletado
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
