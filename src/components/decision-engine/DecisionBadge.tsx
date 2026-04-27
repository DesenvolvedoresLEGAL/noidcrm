import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Zap, Snowflake, Ban } from "lucide-react";
import { useLatestDecisionLog } from "@/hooks/useDecisionEngine";

interface Props {
  prospectId: string;
}

export function DecisionBadge({ prospectId }: Props) {
  const { data: log } = useLatestDecisionLog(prospectId);
  if (!log) return null;

  const label = (log.decision_payload as any)?.priority_label as string | undefined;
  const taken = log.decision_taken;

  if (taken === "executed" && label === "hot") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="default" className="gap-1 bg-destructive/15 text-destructive border-destructive/30">
            <Flame className="h-3 w-3" /> Auto Executado
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Hot lead processado automaticamente</TooltipContent>
      </Tooltip>
    );
  }
  if (taken === "executed" && label === "warm") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" /> Em fila SDR
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Warm lead encaminhado para SDR</TooltipContent>
      </Tooltip>
    );
  }
  if (taken === "executed" && label === "cold") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Snowflake className="h-3 w-3" /> Cold
      </Badge>
    );
  }
  if (taken.startsWith("skipped")) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Ban className="h-3 w-3" /> Ignorado
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{taken.replace("skipped_", "").replace("_", " ")}</TooltipContent>
      </Tooltip>
    );
  }
  if (taken === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        Falhou
      </Badge>
    );
  }
  return null;
}
