import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Radio, Eye, Monitor, Smartphone, Tablet, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Viewer {
  sessionId: string;
  viewedAt: string;
  deviceType?: string;
  city?: string;
}

interface ViewingNowIndicatorProps {
  viewers: Viewer[];
  className?: string;
}

const deviceIcons: Record<string, any> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export function ViewingNowIndicator({ viewers, className }: ViewingNowIndicatorProps) {
  if (viewers.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="destructive" 
            className={cn(
              'animate-pulse gap-1.5 cursor-help',
              className
            )}
          >
            <Radio className="h-3 w-3" />
            <span>
              {viewers.length === 1 
                ? 'Visualizando agora' 
                : `${viewers.length} visualizando`
              }
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium text-sm flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              Visitantes ativos
            </p>
            <div className="space-y-1.5">
              {viewers.map((viewer) => {
                const DeviceIcon = deviceIcons[viewer.deviceType || 'desktop'] || Monitor;
                return (
                  <div key={viewer.sessionId} className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DeviceIcon className="h-3 w-3" />
                      {viewer.deviceType || 'desktop'}
                    </div>
                    {viewer.city && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {viewer.city}
                      </div>
                    )}
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(viewer.viewedAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for header
export function ViewingNowBadge({ isViewing }: { isViewing: boolean }) {
  if (!isViewing) return null;

  return (
    <Badge 
      variant="destructive" 
      className="animate-pulse gap-1 text-[10px] px-1.5 py-0"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      AO VIVO
    </Badge>
  );
}
