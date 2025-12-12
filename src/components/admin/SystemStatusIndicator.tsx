import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SystemStatus = "operational" | "degraded" | "critical";

interface SystemStatusIndicatorProps {
  status?: SystemStatus;
}

const statusConfig: Record<SystemStatus, { label: string; color: string; bgColor: string }> = {
  operational: {
    label: "Sistema Operacional",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
  },
  degraded: {
    label: "Performance Degradada",
    color: "text-amber-500",
    bgColor: "bg-amber-500",
  },
  critical: {
    label: "Incidente Crítico",
    color: "text-destructive",
    bgColor: "bg-destructive",
  },
};

export function SystemStatusIndicator({ status = "operational" }: SystemStatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border">
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                config.bgColor
              )} />
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                config.bgColor
              )} />
            </span>
            <Activity className={cn("h-3.5 w-3.5", config.color)} />
            <span className={cn("text-xs font-medium", config.color)}>
              {status === "operational" ? "OK" : status === "degraded" ? "!" : "!!!"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
