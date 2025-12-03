import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Star, Sparkles } from 'lucide-react';
import { SellerLevel } from '@/services/gamification/badges';

interface LevelProgressCardProps {
  level: SellerLevel;
  sellerName?: string;
}

export function LevelProgressCard({ level, sellerName }: LevelProgressCardProps) {
  const firstName = sellerName?.split(' ')[0] || 'Vendedor';

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Level Badge */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-primary-foreground">{level.level}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </div>
          </div>

          {/* Level Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate">{firstName}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {level.title}
              </span>
            </div>
            
            {/* XP Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {level.totalXP} XP
                </span>
                <span className="text-muted-foreground">
                  {level.nextLevelXP} XP
                </span>
              </div>
              <Progress value={level.progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {Math.round(level.progress)}% para o próximo nível
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
