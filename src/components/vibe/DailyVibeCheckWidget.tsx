import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Flame, 
  Pause, 
  VolumeX, 
  Sparkles,
  ArrowRight,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { useDailyVibeCheck, type DailyVibeItem } from '@/hooks/useDailyVibeCheck';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PRIORITY_CONFIG = {
  hot: {
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Lead mais quente'
  },
  stuck: {
    icon: Pause,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Travado emocionalmente'
  },
  silent: {
    icon: VolumeX,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Não mexa agora'
  },
  nudge: {
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Movimento sutil fecha'
  },
  normal: {
    icon: BarChart3,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Normal'
  }
};

function VibeItem({ item, showEnergy = true }: { item: DailyVibeItem; showEnergy?: boolean }) {
  const navigate = useNavigate();
  const config = PRIORITY_CONFIG[item.priority];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]",
        config.bgColor
      )}
      onClick={() => navigate(`/app/opportunities/${item.id}`)}
    >
      <div className={cn("mt-0.5", config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {showEnergy && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {item.energyScore}%
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.accountName}</p>
        <p className="text-xs mt-1 opacity-80">{item.recommendation}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export function DailyVibeCheckWidget({ className }: { className?: string }) {
  const { data: vibeCheck, isLoading, error } = useDailyVibeCheck();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📊 Seu Vibe Check de Hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !vibeCheck) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📊 Seu Vibe Check de Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o vibe check.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasData = vibeCheck.totalDeals > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📊 Seu Vibe Check de Hoje
          </CardTitle>
          {vibeCheck.requiresAttention > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {vibeCheck.requiresAttention}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {vibeCheck.totalDeals} deals ativos analisados
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!hasData && (
          <div className="text-center py-6">
            <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum deal ativo encontrado
            </p>
          </div>
        )}

        {/* Lead Mais Quente */}
        {vibeCheck.hottestLead && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Lead mais quente</span>
            </div>
            <VibeItem item={vibeCheck.hottestLead} />
          </div>
        )}

        {/* Travados */}
        {vibeCheck.stuckDeals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pause className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Travados emocionalmente</span>
            </div>
            <div className="space-y-2">
              {vibeCheck.stuckDeals.map(item => (
                <VibeItem key={item.id} item={item} showEnergy={false} />
              ))}
            </div>
          </div>
        )}

        {/* Silenciosos */}
        {vibeCheck.silentDeals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <VolumeX className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Não mexa agora</span>
            </div>
            <div className="space-y-2">
              {vibeCheck.silentDeals.map(item => (
                <VibeItem key={item.id} item={item} showEnergy={false} />
              ))}
            </div>
          </div>
        )}

        {/* Nudge */}
        {vibeCheck.nudgeOpportunities.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Movimento sutil fecha</span>
            </div>
            <div className="space-y-2">
              {vibeCheck.nudgeOpportunities.map(item => (
                <VibeItem key={item.id} item={item} showEnergy={false} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
