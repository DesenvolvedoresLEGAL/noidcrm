import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award, Lock, Flame, Target, Trophy, Sparkles } from 'lucide-react';
import { Badge, getRarityLabel, getRarityColor } from '@/services/gamification/badges';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface BadgeShowcaseProps {
  badges: Badge[];
  badgesByCategory: Record<string, Badge[]>;
}

const categoryLabels: Record<string, { label: string; icon: any }> = {
  training: { label: 'Treino', icon: Target },
  streak: { label: 'Streak', icon: Flame },
  performance: { label: 'Performance', icon: Trophy },
  special: { label: 'Especial', icon: Sparkles },
};

function getBadgeIcon(iconName: string) {
  const IconComponent = (LucideIcons as any)[
    iconName.split('-').map((s: string, i: number) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || Award;
  return IconComponent;
}

function BadgeItem({ badge }: { badge: Badge }) {
  const IconComponent = getBadgeIcon(badge.icon);
  const rarityColor = getRarityColor(badge.rarity);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "relative flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer",
              badge.unlocked 
                ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 hover:border-primary/50"
                : "bg-muted/30 border-muted grayscale opacity-60 hover:opacity-80"
            )}
          >
            {/* Rarity indicator */}
            {badge.unlocked && badge.rarity >= 3 && (
              <div className="absolute -top-1 -right-1">
                <Sparkles className={cn("h-4 w-4", rarityColor)} />
              </div>
            )}
            
            {/* Icon */}
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-2",
              badge.unlocked 
                ? "bg-primary/20" 
                : "bg-muted"
            )}>
              {badge.unlocked ? (
                <IconComponent className={cn("h-6 w-6", rarityColor)} />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            
            {/* Name */}
            <span className={cn(
              "text-xs font-medium text-center line-clamp-2",
              badge.unlocked ? "text-foreground" : "text-muted-foreground"
            )}>
              {badge.name}
            </span>
            
            {/* XP */}
            <span className="text-[10px] text-muted-foreground mt-1">
              +{badge.xp_reward} XP
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{badge.name}</span>
              <BadgeUI variant="outline" className={cn("text-[10px]", rarityColor)}>
                {getRarityLabel(badge.rarity)}
              </BadgeUI>
            </div>
            <p className="text-xs text-muted-foreground">{badge.description}</p>
            {badge.unlocked && badge.unlocked_at && (
              <p className="text-xs text-primary">
                Desbloqueado em {new Date(badge.unlocked_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BadgeShowcase({ badges, badgesByCategory }: BadgeShowcaseProps) {
  const [activeTab, setActiveTab] = useState('all');
  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Badges
          </CardTitle>
          <BadgeUI variant="secondary">
            {unlockedCount}/{badges.length}
          </BadgeUI>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
            {Object.entries(categoryLabels).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {badges
                .sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))
                .map(badge => (
                  <BadgeItem key={badge.id} badge={badge} />
                ))}
            </div>
          </TabsContent>

          {Object.keys(categoryLabels).map(category => (
            <TabsContent key={category} value={category} className="mt-0">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {(badgesByCategory[category] || [])
                  .sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))
                  .map(badge => (
                    <BadgeItem key={badge.id} badge={badge} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
