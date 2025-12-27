import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface AdminDashboardData {
  dataQuality: {
    score: number;
    completeness: number;
    duplicates: number;
    errors: number;
  };
  integrationStatus: {
    total: number;
    healthy: number;
    errors: number;
    errorsByType: { type: string; count: number }[];
  };
  automations: {
    total: number;
    active: number;
    executions: number;
    failures: number;
    byStatus: { status: string; count: number }[];
  };
  systemUsage: {
    totalUsers: number;
    activeToday: number;
    byRole: { role: string; count: number }[];
  };
  voltsUsage: {
    total: number;
    byOperation: { operation: string; count: number }[];
  };
  duplicateAlerts: number;
  automationFlow: { stage: string; count: number; failures: number }[];
  failureHistory: { date: string; count: number }[];
  leadsByChannel: { channel: string; count: number }[];
  incompleteRecords: { entity: string; id: string; name: string; missingFields: string[] }[];
  automationsNeedingReview: { id: string; name: string; lastRun: string; status: string }[];
  duplicateRecords: { entity: string; name: string; count: number }[];
  missingRequiredFields: { entity: string; field: string; count: number }[];
}

export function useAdminDashboard() {
  const { profile } = useCurrentUser();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['admin-dashboard', organizationId],
    queryFn: async (): Promise<AdminDashboardData> => {
      if (!organizationId) throw new Error('No organization');

      // Fetch all data in parallel
      const [
        accountsResult,
        contactsResult,
        opportunitiesResult,
        workflowRulesResult,
        workflowExecutionsResult,
        membersResult,
        aiActionsResult,
        automationLogsResult,
      ] = await Promise.all([
        supabase.from('accounts').select('id, razao_social, nome_fantasia, cnpj, emails, telefones, cidade, uf').eq('organization_id', organizationId),
        supabase.from('contacts').select('id, nome, emails, telefones, cargo').eq('organization_id', organizationId),
        supabase.from('opportunities').select('id, title, origem, created_at').eq('organization_id', organizationId),
        supabase.from('workflow_rules').select('*').eq('organization_id', organizationId),
        supabase.from('workflow_executions').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(500),
        supabase.from('organization_members').select('id, org_role, status, user_id').eq('organization_id', organizationId),
        supabase.from('ai_actions').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
        supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(200),
      ]);

      const accounts = accountsResult.data || [];
      const contacts = contactsResult.data || [];
      const opportunities = opportunitiesResult.data || [];
      const workflowRules = workflowRulesResult.data || [];
      const workflowExecutions = workflowExecutionsResult.data || [];
      const members = membersResult.data || [];
      const aiActions = aiActionsResult.data || [];
      const automationLogs = automationLogsResult.data || [];

      // Calculate Data Quality Score
      const calculateCompleteness = () => {
        let totalFields = 0;
        let filledFields = 0;

        accounts.forEach(acc => {
          const fields = ['razao_social', 'cnpj', 'emails', 'telefones', 'cidade', 'uf'];
          fields.forEach(f => {
            totalFields++;
            const value = acc[f as keyof typeof acc];
            if (value && (Array.isArray(value) ? value.length > 0 : true)) filledFields++;
          });
        });

        contacts.forEach(cont => {
          const fields = ['nome', 'emails', 'telefones', 'cargo'];
          fields.forEach(f => {
            totalFields++;
            const value = cont[f as keyof typeof cont];
            if (value && (Array.isArray(value) ? value.length > 0 : true)) filledFields++;
          });
        });

        return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100;
      };

      // Detect duplicates (by name similarity)
      const detectDuplicates = () => {
        const accountNames = accounts.map(a => (a.razao_social || '').toLowerCase().trim()).filter(Boolean);
        const contactNames = contacts.map(c => (c.nome || '').toLowerCase().trim()).filter(Boolean);
        
        const findDupes = (names: string[]) => {
          const seen = new Map<string, number>();
          names.forEach(name => {
            seen.set(name, (seen.get(name) || 0) + 1);
          });
          return Array.from(seen.entries()).filter(([_, count]) => count > 1).length;
        };

        return findDupes(accountNames) + findDupes(contactNames);
      };

      const completeness = calculateCompleteness();
      const duplicates = detectDuplicates();
      const dataQualityScore = Math.max(0, Math.round(completeness - (duplicates * 2)));

      // Integration errors (from automation logs)
      const integrationErrors = automationLogs.filter(log => log.status === 'failed');
      const errorsByType = integrationErrors.reduce((acc, log) => {
        const type = log.channel || 'API';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Automation stats
      const activeAutomations = workflowRules.filter(r => r.is_active).length;
      const failedExecutions = workflowExecutions.filter(e => e.status === 'failed').length;
      const executionsByStatus = workflowExecutions.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // User analytics
      const today = new Date().toISOString().split('T')[0];
      const activeMembers = members.filter(m => m.status === 'active');
      const roleCount = activeMembers.reduce((acc, m) => {
        const role = m.org_role || 'sales';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // VOLTS usage (AI actions)
      const voltsTotal = aiActions.length;
      const voltsByOperation = aiActions.reduce((acc, a) => {
        acc[a.action_type] = (acc[a.action_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Automation flow by trigger type
      const automationFlow = workflowRules.reduce((acc, rule) => {
        const stage = rule.trigger_type || 'unknown';
        const existing = acc.find(a => a.stage === stage);
        const executions = workflowExecutions.filter(e => e.workflow_rule_id === rule.id);
        const failures = executions.filter(e => e.status === 'failed').length;
        
        if (existing) {
          existing.count++;
          existing.failures += failures;
        } else {
          acc.push({ stage, count: 1, failures });
        }
        return acc;
      }, [] as { stage: string; count: number; failures: number }[]);

      // Failure history (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const failureHistory = last7Days.map(date => ({
        date,
        count: workflowExecutions.filter(e => 
          e.status === 'failed' && 
          e.created_at?.startsWith(date)
        ).length
      }));

      // Leads by channel/origin
      const leadsByChannel = opportunities.reduce((acc, opp) => {
        const channel = opp.origem || 'Direto';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Incomplete records
      const incompleteRecords: AdminDashboardData['incompleteRecords'] = [];
      
      accounts.slice(0, 10).forEach(acc => {
        const missing: string[] = [];
        if (!acc.cnpj) missing.push('CNPJ');
        if (!acc.emails || acc.emails.length === 0) missing.push('E-mail');
        if (!acc.telefones) missing.push('Telefone');
        if (!acc.cidade) missing.push('Cidade');
        
        if (missing.length > 0) {
          incompleteRecords.push({
            entity: 'Conta',
            id: acc.id,
            name: acc.nome_fantasia || acc.razao_social,
            missingFields: missing
          });
        }
      });

      // Automations needing review (failed or inactive for long time)
      const automationsNeedingReview = workflowRules
        .filter(r => {
          const executions = workflowExecutions.filter(e => e.workflow_rule_id === r.id);
          const hasRecentFailure = executions.some(e => e.status === 'failed');
          return hasRecentFailure || !r.is_active;
        })
        .slice(0, 5)
        .map(r => {
          const lastExec = workflowExecutions.find(e => e.workflow_rule_id === r.id);
          return {
            id: r.id,
            name: r.name,
            lastRun: lastExec?.created_at || 'Nunca',
            status: r.is_active ? 'Com falhas' : 'Inativa'
          };
        });

      // Duplicate records detail
      const duplicateRecords: AdminDashboardData['duplicateRecords'] = [];
      const accountNameCounts = accounts.reduce((acc, a) => {
        const name = (a.razao_social || '').toLowerCase().trim();
        if (name) acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(accountNameCounts)
        .filter(([_, count]) => count > 1)
        .slice(0, 5)
        .forEach(([name, count]) => {
          duplicateRecords.push({ entity: 'Conta', name, count });
        });

      // Missing required fields summary
      const missingRequiredFields: AdminDashboardData['missingRequiredFields'] = [
        { entity: 'Contas', field: 'CNPJ', count: accounts.filter(a => !a.cnpj).length },
        { entity: 'Contas', field: 'E-mail', count: accounts.filter(a => !a.emails || (Array.isArray(a.emails) && a.emails.length === 0)).length },
        { entity: 'Contatos', field: 'E-mail', count: contacts.filter(c => !c.emails || (Array.isArray(c.emails) && c.emails.length === 0)).length },
        { entity: 'Contatos', field: 'Telefone', count: contacts.filter(c => !c.telefones || (Array.isArray(c.telefones) && c.telefones.length === 0)).length },
      ].filter(f => f.count > 0);

      return {
        dataQuality: {
          score: dataQualityScore,
          completeness,
          duplicates,
          errors: integrationErrors.length
        },
        integrationStatus: {
          total: automationLogs.length,
          healthy: automationLogs.filter(l => l.status === 'completed').length,
          errors: integrationErrors.length,
          errorsByType: Object.entries(errorsByType).map(([type, count]) => ({ type, count }))
        },
        automations: {
          total: workflowRules.length,
          active: activeAutomations,
          executions: workflowExecutions.length,
          failures: failedExecutions,
          byStatus: Object.entries(executionsByStatus).map(([status, count]) => ({ status, count }))
        },
        systemUsage: {
          totalUsers: members.length,
          activeToday: activeMembers.length,
          byRole: Object.entries(roleCount).map(([role, count]) => ({ role, count }))
        },
        voltsUsage: {
          total: voltsTotal,
          byOperation: Object.entries(voltsByOperation).map(([operation, count]) => ({ operation, count }))
        },
        duplicateAlerts: duplicates,
        automationFlow,
        failureHistory,
        leadsByChannel: Object.entries(leadsByChannel).map(([channel, count]) => ({ channel, count })),
        incompleteRecords,
        automationsNeedingReview,
        duplicateRecords,
        missingRequiredFields
      };
    },
    enabled: !!organizationId,
    refetchInterval: 60000 // Refresh every minute
  });
}
