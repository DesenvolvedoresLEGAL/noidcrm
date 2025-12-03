import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Sparkles, X } from 'lucide-react';
import { Badge, getRarityLabel, getRarityColor } from '@/services/gamification/badges';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BadgeUnlockModalProps {
  badge: Badge | null;
  onClose: () => void;
}

function getBadgeIcon(iconName: string) {
  const IconComponent = (LucideIcons as any)[
    iconName.split('-').map((s: string, i: number) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LucideIcons.Award;
  return IconComponent;
}

export function BadgeUnlockModal({ badge, onClose }: BadgeUnlockModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (badge) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [badge]);

  if (!badge) return null;

  const IconComponent = getBadgeIcon(badge.icon);
  const rarityColor = getRarityColor(badge.rarity);

  return (
    <Dialog open={!!badge} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md border-primary/50 bg-gradient-to-b from-background to-primary/5 overflow-hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-4"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <AnimatePresence>
          {showConfetti && (
            <motion.div 
              className="absolute inset-0 pointer-events-none overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    left: `${Math.random() * 100}%`,
                    top: '-10px',
                  }}
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ 
                    y: 400, 
                    opacity: 0,
                    x: (Math.random() - 0.5) * 100 
                  }}
                  transition={{ 
                    duration: 2 + Math.random(),
                    delay: Math.random() * 0.5,
                    ease: 'easeOut'
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center py-6 text-center">
          {/* Celebration text */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          >
            <h2 className="text-2xl font-black text-primary mb-2">
              🎉 BADGE DESBLOQUEADO!
            </h2>
          </motion.div>

          {/* Badge Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
            className="relative my-6"
          >
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg ring-4 ring-primary/20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <IconComponent className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
            {badge.rarity >= 3 && (
              <motion.div 
                className="absolute -top-2 -right-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Sparkles className={cn("h-8 w-8", rarityColor)} />
              </motion.div>
            )}
          </motion.div>

          {/* Badge Name */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-2"
          >
            <h3 className="text-xl font-bold text-foreground">{badge.name}</h3>
            <BadgeUI variant="outline" className={cn("text-sm", rarityColor)}>
              {getRarityLabel(badge.rarity)}
            </BadgeUI>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground mt-4 max-w-xs"
          >
            {badge.description}
          </motion.p>

          {/* XP Earned */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: 'spring' }}
            className="mt-6 px-6 py-3 bg-primary/10 rounded-full"
          >
            <span className="text-lg font-bold text-primary">
              +{badge.xp_reward} XP
            </span>
          </motion.div>

          {/* Close Button */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6"
          >
            <Button onClick={onClose} className="px-8">
              Continuar
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
