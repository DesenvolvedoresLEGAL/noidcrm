import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, Clock, AlertCircle } from "lucide-react";
import type { UserActivityData } from "@/hooks/useUserActivityData";
import { getLastSeen } from "@/hooks/useUserActivityData";

interface UserActivityBadgeProps {
  activity: UserActivityData | undefined;
  isLoading?: boolean;
}

export function UserActivityBadge({ activity, isLoading }: UserActivityBadgeProps) {
  if (isLoading) {
    return (
      <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
    );
  }

  const lastSeen = getLastSeen(activity);
  const now = new Date();

  if (!lastSeen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Nunca
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Nenhuma atividade registrada</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const diffMs = now.getTime() - lastSeen.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Determine activity status
  let statusColor: string;
  let StatusIcon: typeof Activity;

  if (diffHours < 1) {
    statusColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    StatusIcon = Activity;
  } else if (diffHours < 24) {
    statusColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
    StatusIcon = Activity;
  } else if (diffDays < 7) {
    statusColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
    StatusIcon = Clock;
  } else {
    statusColor = "bg-muted text-muted-foreground";
    StatusIcon = Clock;
  }

  const timeAgo = formatDistanceToNow(lastSeen, {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className={`gap-1 ${statusColor}`}>
            <StatusIcon className="h-3 w-3" />
            {timeAgo}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="space-y-1">
          <p className="font-medium">Último acesso real</p>
          <p className="text-xs text-muted-foreground">
            Baseado em ações no sistema (audit_log)
          </p>
          {activity && (
            <div className="text-xs space-y-0.5 pt-1 border-t">
              <p>Ações últimas 24h: <span className="font-medium">{activity.activityCount24h}</span></p>
              <p>Ações últimos 7d: <span className="font-medium">{activity.activityCount7d}</span></p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
