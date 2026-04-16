import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, Calendar, Eye, Clock, MessageCircle, 
  TrendingDown, Target, ExternalLink, Sunrise 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DailySummary {
  date: string;
  user_name: string;
  overdue_activities: number;
  today_activities: number;
  proposal_views_last_24h: number;
  proposals_expiring_today: number;
  proposals_expiring_tomorrow: number;
  client_replies_last_24h: number;
  stale_opportunities: number;
  top_items: Array<{
    type: string;
    label: string;
    action_url: string;
  }>;
}

export function RepDailySummary() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const userId = user?.id;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["daily-digest", userId, todayStr],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("daily_digest_cache")
        .select("summary_json")
        .eq("user_id", userId)
        .eq("digest_date", todayStr)
        .maybeSingle();
      return data?.summary_json as unknown as DailySummary | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !summary) return null;

  const hasUrgent = summary.overdue_activities > 0 || summary.proposals_expiring_today > 0;
  const todayFormatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const metrics = [
    {
      icon: AlertTriangle,
      label: "Atrasadas",
      value: summary.overdue_activities,
      color: summary.overdue_activities > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: summary.overdue_activities > 0 ? "bg-destructive/10" : "bg-muted/50",
    },
    {
      icon: Calendar,
      label: "Hoje",
      value: summary.today_activities,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Clock,
      label: "Vencendo hoje",
      value: summary.proposals_expiring_today,
      color: summary.proposals_expiring_today > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
      bgColor: summary.proposals_expiring_today > 0 ? "bg-orange-500/10" : "bg-muted/50",
    },
    {
      icon: Clock,
      label: "Vencendo amanhã",
      value: summary.proposals_expiring_tomorrow,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Eye,
      label: "Visualizadas (24h)",
      value: summary.proposal_views_last_24h,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: MessageCircle,
      label: "Respostas",
      value: summary.client_replies_last_24h,
      color: summary.client_replies_last_24h > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
      bgColor: summary.client_replies_last_24h > 0 ? "bg-green-500/10" : "bg-muted/50",
    },
    {
      icon: TrendingDown,
      label: "Paradas",
      value: summary.stale_opportunities,
      color: summary.stale_opportunities > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: summary.stale_opportunities > 0 ? "bg-destructive/10" : "bg-muted/50",
    },
  ];

  return (
    <Card className={`border ${hasUrgent ? "border-destructive/30 shadow-destructive/5 shadow-lg" : "border-primary/20"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Resumo do Dia</CardTitle>
            {hasUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Atenção
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground capitalize">{todayFormatted}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className={`flex flex-col items-center p-2.5 rounded-lg ${m.bgColor}`}>
              <m.icon className={`h-4 w-4 mb-1 ${m.color}`} />
              <span className={`text-xl font-bold ${m.color}`}>{m.value}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Top Priorities */}
        {summary.top_items && summary.top_items.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Top Prioridades</span>
            </div>
            <div className="space-y-1">
              {summary.top_items.slice(0, 3).map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.action_url)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">
                      {item.type === "proposal_expiring" ? "⏰" : "⚠️"}
                    </span>
                    <span className="text-xs truncate">{item.label}</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
