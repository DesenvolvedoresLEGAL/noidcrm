import { Badge } from "@/components/ui/badge";
import { SuggestionStatus } from "@/hooks/useSuggestions";
import { Clock, Calendar, Code, Rocket, XCircle } from "lucide-react";

interface SuggestionStatusBadgeProps {
  status: SuggestionStatus;
}

const statusConfig: Record<SuggestionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; className: string }> = {
  under_review: { 
    label: "Em análise", 
    variant: "secondary", 
    icon: Clock,
    className: "bg-muted text-muted-foreground border-muted-foreground/20"
  },
  planned: { 
    label: "Planejada", 
    variant: "outline", 
    icon: Calendar,
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400"
  },
  in_development: { 
    label: "Em desenvolvimento", 
    variant: "default", 
    icon: Code,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400"
  },
  launched: { 
    label: "Lançada 🎉", 
    variant: "default", 
    icon: Rocket,
    className: "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400"
  },
  declined: { 
    label: "Não priorizada", 
    variant: "destructive", 
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30"
  },
};

export function SuggestionStatusBadge({ status }: SuggestionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
