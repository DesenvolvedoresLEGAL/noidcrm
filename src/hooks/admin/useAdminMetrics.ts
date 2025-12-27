import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminMetrics {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  totalMRR: number;
  totalARR: number;
  churnRate: number;
  growthRate: number;
  totalVoltsConsumed: number;
  totalOpportunities: number;
  totalProposals: number;
  totalActivities: number;
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async (): Promise<AdminMetrics> => {
      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, status, created_at");

      if (orgsError) throw orgsError;

      const totalOrganizations = orgs?.length || 0;
      const activeOrganizations = orgs?.filter(o => o.status === 'active').length || 0;
      const trialOrganizations = orgs?.filter(o => o.status === 'trial').length || 0;
      const suspendedOrganizations = orgs?.filter(o => o.status === 'suspended').length || 0;

      // Fetch users
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, last_login_at");

      if (usersError) throw usersError;

      const totalUsers = users?.length || 0;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const activeUsersToday = users?.filter(u => 
        u.last_login_at && new Date(u.last_login_at) >= today
      ).length || 0;

      const activeUsersWeek = users?.filter(u => 
        u.last_login_at && new Date(u.last_login_at) >= weekAgo
      ).length || 0;

      // Fetch AI usage (VOLTS)
      const { data: aiUsage, error: aiError } = await supabase
        .from("ai_usage_logs")
        .select("volts_used");

      const totalVoltsConsumed = aiUsage?.reduce((sum, log) => sum + (log.volts_used || 0), 0) || 0;

      // Fetch opportunities count
      const { count: oppCount } = await supabase
        .from("opportunities")
        .select("id", { count: 'exact', head: true });

      // Fetch proposals count
      const { count: proposalCount } = await supabase
        .from("proposals")
        .select("id", { count: 'exact', head: true });

      // Fetch activities count
      const { count: activityCount } = await supabase
        .from("activities")
        .select("id", { count: 'exact', head: true });

      // =================== MRR GLOBAL (CENTRALIZADO) ===================
      // Usa função centralizada que já exclui organizações internas
      const { calculateGlobalMRR } = await import('@/services/crm/mrr-calculations');
      const mrrResult = await calculateGlobalMRR();
      const totalMRR = mrrResult.totalMRR;

      return {
        totalOrganizations,
        activeOrganizations,
        trialOrganizations,
        suspendedOrganizations,
        totalUsers,
        activeUsersToday,
        activeUsersWeek,
        totalMRR,
        totalARR: totalMRR * 12,
        churnRate: 0, // Would need historical data
        growthRate: 0, // Would need historical data
        totalVoltsConsumed,
        totalOpportunities: oppCount || 0,
        totalProposals: proposalCount || 0,
        totalActivities: activityCount || 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useAdminAlerts() {
  return useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      // For now, generate alerts based on system state
      const alerts: Array<{
        id: string;
        type: "error" | "warning" | "info" | "success";
        title: string;
        message: string;
        created_at: string;
        resolved: boolean;
      }> = [];

      // Check for organizations in trial expiring soon
      const { data: trialOrgs } = await supabase
        .from("organizations")
        .select("id, name, trial_ends_at")
        .eq("status", "trial")
        .not("trial_ends_at", "is", null);

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      trialOrgs?.forEach(org => {
        if (org.trial_ends_at && new Date(org.trial_ends_at) <= threeDaysFromNow) {
          alerts.push({
            id: `trial-${org.id}`,
            type: "warning",
            title: "Trial Expirando",
            message: `${org.name} tem trial expirando em breve`,
            created_at: now.toISOString(),
            resolved: false,
          });
        }
      });

      // Check for workflow execution failures
      const { data: failedWorkflows } = await supabase
        .from("workflow_executions")
        .select("id, created_at")
        .eq("status", "failed")
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (failedWorkflows && failedWorkflows.length > 0) {
        alerts.push({
          id: "workflow-failures",
          type: "error",
          title: "Falhas em Automações",
          message: `${failedWorkflows.length} automações falharam nas últimas 24h`,
          created_at: now.toISOString(),
          resolved: false,
        });
      }

      // Check for high AI usage
      const { data: recentAI } = await supabase
        .from("ai_usage_logs")
        .select("volts_used")
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

      const dailyVolts = recentAI?.reduce((sum, log) => sum + (log.volts_used || 0), 0) || 0;
      if (dailyVolts > 10000) {
        alerts.push({
          id: "high-ai-usage",
          type: "info",
          title: "Alto Consumo de IA",
          message: `${dailyVolts.toLocaleString()} VOLTS consumidos hoje`,
          created_at: now.toISOString(),
          resolved: false,
        });
      }

      return alerts;
    },
    refetchInterval: 120000, // Refresh every 2 minutes
  });
}
