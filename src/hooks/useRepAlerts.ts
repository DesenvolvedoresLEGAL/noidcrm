import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RepAlert {
  id: string;
  type: "proposal_viewed" | "activity_overdue" | "next_step" | "opportunity_stale";
  message: string;
  timestamp: string;
  entityId?: string;
  entityType?: string;
}

export function useRepAlerts() {
  const { user, organization } = useCurrentUser();
  const userId = user?.id;
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["rep-alerts", userId, orgId],
    queryFn: async (): Promise<RepAlert[]> => {
      if (!userId || !orgId) return [];

      const alerts: RepAlert[] = [];
      const now = new Date();

      // 1. Get recently viewed proposals (last 24h)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // First get user's opportunity IDs
      const { data: userOpps } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("owner_user_id", userId);
      
      const oppIds = userOpps?.map(o => o.id) || [];
      const oppMap = new Map(userOpps?.map(o => [o.id, o.title]) || []);

      if (oppIds.length > 0) {
        // Get proposals for user's opportunities that were recently viewed
        const { data: recentProposals } = await supabase
          .from("proposals")
          .select("id, opportunity_id, updated_at, views_count")
          .in("opportunity_id", oppIds)
          .eq("status", "viewed")
          .gte("updated_at", oneDayAgo.toISOString())
          .order("updated_at", { ascending: false })
          .limit(3);

        recentProposals?.forEach(proposal => {
          const oppTitle = oppMap.get(proposal.opportunity_id) || "Oportunidade";
          alerts.push({
            id: `proposal-${proposal.id}`,
            type: "proposal_viewed",
            message: `Proposta de "${oppTitle}" foi visualizada`,
            timestamp: formatDistanceToNow(new Date(proposal.updated_at), { addSuffix: true, locale: ptBR }),
            entityId: proposal.id,
            entityType: "proposal",
          });
        });
      }

      // 2. Get overdue activities
      const { data: overdueActivities } = await supabase
        .from("activities")
        .select("id, title, scheduled_date")
        .eq("owner_user_id", userId)
        .eq("status", "pending")
        .lt("scheduled_date", now.toISOString())
        .order("scheduled_date", { ascending: true })
        .limit(3);

      overdueActivities?.forEach(activity => {
        alerts.push({
          id: `activity-${activity.id}`,
          type: "activity_overdue",
          message: `Atividade atrasada: ${activity.title}`,
          timestamp: formatDistanceToNow(new Date(activity.scheduled_date), { addSuffix: true, locale: ptBR }),
          entityId: activity.id,
          entityType: "activity",
        });
      });

      // 3. Get pending AI suggestions
      const { data: aiSuggestions } = await supabase
        .from("ai_suggestions")
        .select("id, suggestion_type, reasoning, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(2);

      aiSuggestions?.forEach(suggestion => {
        alerts.push({
          id: `ai-${suggestion.id}`,
          type: "next_step",
          message: suggestion.reasoning || `IA sugere: ${suggestion.suggestion_type}`,
          timestamp: formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true, locale: ptBR }),
          entityId: suggestion.id,
          entityType: "ai_suggestion",
        });
      });

      // 4. Get stale opportunities (no activity in 7+ days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: staleOpps } = await supabase
        .from("opportunities")
        .select("id, title, updated_at")
        .eq("owner_user_id", userId)
        .eq("status", "open")
        .lt("updated_at", sevenDaysAgo.toISOString())
        .order("updated_at", { ascending: true })
        .limit(2);

      staleOpps?.forEach(opp => {
        const daysStale = Math.floor((now.getTime() - new Date(opp.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `stale-${opp.id}`,
          type: "opportunity_stale",
          message: `"${opp.title}" sem atualização há ${daysStale} dias`,
          timestamp: formatDistanceToNow(new Date(opp.updated_at), { addSuffix: true, locale: ptBR }),
          entityId: opp.id,
          entityType: "opportunity",
        });
      });

      // Sort by most recent and limit
      return alerts.slice(0, 5);
    },
    enabled: !!userId && !!orgId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
