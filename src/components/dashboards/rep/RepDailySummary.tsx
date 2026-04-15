import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  Eye,
  Clock,
  MessageCircle,
  TrendingDown,
  ArrowRight,
  Sunrise,
} from "lucide-react";

interface DailySummary {
  date: string;
  overdue_activities: number;
  today_activities: number;
  proposal_views_last_24h: number;
  proposals_expiring_today: number;
  proposals_expiring_tomorrow: number;
  client_replies_last_24h: number;
  stale_opportunities: number;
  top_items: Array<{ type: string; label: string; action_url: string }>;
}

export function RepDailySummary() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const userId = user?.id;
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: summary, isLoading } = useQuery({
    queryKey: ["daily-digest", userId, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_digest_cache")
        .select("summary_json")
        .eq("user_id", userId!)
        .eq("digest_date", todayStr)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.summary_json as DailySummary | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const blocks = [
    {
      icon: AlertTriangle,
      label: "Atividades atrasadas",
      count: summary.overdue_activities,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      urgent: summary.overdue_activities > 0,
    },
    {
      icon: Calendar,
      label: "Atividades do dia",
      count: summary.today_activities,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      urgent: false,
    },
    {
      icon: Eye,
      label: "Propostas abertas",
      count: summary.proposal_views_last_24h,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      urgent: false,
    },
    {
      icon: Clock,
      label: "Vencendo hoje",
      count: summary.proposals_expiring_today,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      urgent: summary.proposals_expiring_today > 0,
    },
    {
      icon: Clock,
      label: "Vencendo amanhã",
      count: summary.proposals_expiring_tomorrow,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      urgent: false,
    },
    {
      icon: MessageCircle,
      label: "Respostas do cliente",
      count: summary.client_replies_last_24h,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      urgent: summary.client_replies_last_24h > 0,
    },
    {
      icon: TrendingDown,
      label: "Oportunidades paradas",
      count: summary.stale_opportunities,
      color: "text-slate-500",
      bgColor: "bg-slate-500/10",
      urgent: false,
    },
  ];

  const totalPriorities =
    summary.overdue_activities +
    summary.proposals_expiring_today +
    summary.client_replies_last_24h;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Resumo do Dia</CardTitle>
          </div>
          {totalPriorities > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalPriorities} prioridade{totalPriorities > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {blocks.map((block) => {
            const Icon = block.icon;
            return (
              <div
                key={block.label}
                className={`relative rounded-lg p-3 ${block.bgColor} ${
                  block.urgent ? "ring-1 ring-red-500/30" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${block.color}`} />
                  <span className="text-xs text-muted-foreground truncate">
                    {block.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${block.color}`}>
                  {block.count}
                </p>
              </div>
            );
          })}
        </div>

        {/* Top Priorities */}
        {summary.top_items && summary.top_items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              🎯 Top Prioridades
            </p>
            <div className="space-y-1.5">
              {summary.top_items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(item.action_url)}
                  className="w-full flex items-center justify-between p-2.5 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">
                      {item.type === "proposal_expiring" ? "⏰" : "🔴"}
                    </span>
                    <span className="text-sm truncate">{item.label}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
