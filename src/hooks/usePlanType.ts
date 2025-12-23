import { useEntitlements } from '@/hooks/useEntitlements';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export type AIMode = 'assistive' | 'autonomous';
export type PlanType = 'neural' | 'autonomous' | 'freemium';

export interface PlanCapabilities {
  canUseAgents: boolean;
  canExecuteAutonomously: boolean;
  hasMemoryEngine: boolean;
  consumesVolts: boolean;
  hasAdvancedReports: boolean;
  hasSequences: boolean;
  hasAutomations: boolean;
  hasApiAccess: boolean;
  hasPrioritySupport: boolean;
}

export function usePlanType() {
  const { planId, get, can, isLoading, isTrial, trialEndsAt, isPlanLocked } = useEntitlements();
  const { organization } = useCurrentOrganization();

  const aiMode = (get('ai_mode', 'assistive') as AIMode);
  
  // Determine plan type based on planId or aiMode
  const isNeural = planId === 'neural' || aiMode === 'assistive';
  const isAutonomous = planId === 'autonomous' || aiMode === 'autonomous';
  const isFreemium = planId === 'freemium' || (!isNeural && !isAutonomous);

  // Get plan type as enum
  const planType: PlanType = isAutonomous ? 'autonomous' : isNeural ? 'neural' : 'freemium';

  // Feature checks
  const capabilities: PlanCapabilities = {
    canUseAgents: get('agents_enabled') === 'true',
    canExecuteAutonomously: get('autonomous_execution') === 'true',
    hasMemoryEngine: get('memory_engine') === 'true',
    consumesVolts: get('volts_consumption') === 'true',
    hasAdvancedReports: get('advanced_reports') === 'true',
    hasSequences: get('sequences_enabled') === 'true',
    hasAutomations: get('automations_enabled') === 'true',
    hasApiAccess: get('api_access') === 'true',
    hasPrioritySupport: get('priority_support') === 'true',
  };

  // Plan display info
  const planDisplayName = isAutonomous ? 'Autonomous' : isNeural ? 'Neural' : 'Freemium';
  const planIcon = isAutonomous ? '🤖' : isNeural ? '🧠' : '⚡';
  const planColor = isAutonomous ? 'text-purple-500' : isNeural ? 'text-blue-500' : 'text-gray-500';
  const planBgColor = isAutonomous ? 'bg-purple-500/10' : isNeural ? 'bg-blue-500/10' : 'bg-gray-500/10';
  const planBorderColor = isAutonomous ? 'border-purple-500/30' : isNeural ? 'border-blue-500/30' : 'border-gray-500/30';

  // Trial info
  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    // Plan identification
    planId,
    planType,
    aiMode,
    isNeural,
    isAutonomous,
    isFreemium,
    isLoading,

    // Trial status
    isTrial,
    trialEndsAt,
    trialDaysRemaining,
    isPlanLocked,

    // Capabilities object
    capabilities,

    // Individual capability checks (convenience methods)
    canUseAgents: () => capabilities.canUseAgents,
    canExecuteAutonomously: () => capabilities.canExecuteAutonomously,
    hasMemoryEngine: () => capabilities.hasMemoryEngine,
    consumesVolts: () => capabilities.consumesVolts,

    // Display helpers
    planDisplayName,
    planIcon,
    planColor,
    planBgColor,
    planBorderColor,

    // Organization reference
    organization,
  };
}
