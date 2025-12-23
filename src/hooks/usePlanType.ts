import { useEntitlements } from '@/hooks/useEntitlements';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export type AIMode = 'assistive' | 'autonomous';
export type PlanType = 'neural' | 'autonomous' | 'freemium' | 'internal_full';

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
  const isInternalFull = planId === 'internal_full';
  const isNeural = planId === 'neural' || aiMode === 'assistive';
  const isAutonomous = planId === 'autonomous' || aiMode === 'autonomous' || isInternalFull;
  const isFreemium = planId === 'freemium' || (!isNeural && !isAutonomous && !isInternalFull);

  // Get plan type as enum
  const planType: PlanType = isInternalFull ? 'internal_full' : isAutonomous ? 'autonomous' : isNeural ? 'neural' : 'freemium';

  // Feature checks - internal_full has all features enabled
  const capabilities: PlanCapabilities = {
    canUseAgents: isInternalFull || get('agents_enabled') === 'true',
    canExecuteAutonomously: isInternalFull || get('autonomous_execution') === 'true',
    hasMemoryEngine: isInternalFull || get('memory_engine') === 'true',
    consumesVolts: !isInternalFull && get('volts_consumption') === 'true',
    hasAdvancedReports: isInternalFull || get('advanced_reports') === 'true',
    hasSequences: isInternalFull || get('sequences_enabled') === 'true',
    hasAutomations: isInternalFull || get('automations_enabled') === 'true',
    hasApiAccess: isInternalFull || get('api_access') === 'true',
    hasPrioritySupport: isInternalFull || get('priority_support') === 'true',
  };

  // Plan display info
  const planDisplayName = isInternalFull ? 'Internal Full' : isAutonomous ? 'Autonomous' : isNeural ? 'Neural' : 'Freemium';
  const planIcon = isInternalFull ? '⚡' : isAutonomous ? '🤖' : isNeural ? '🧠' : '⚡';
  const planColor = isInternalFull ? 'text-amber-500' : isAutonomous ? 'text-purple-500' : isNeural ? 'text-blue-500' : 'text-gray-500';
  const planBgColor = isInternalFull ? 'bg-amber-500/10' : isAutonomous ? 'bg-purple-500/10' : isNeural ? 'bg-blue-500/10' : 'bg-gray-500/10';
  const planBorderColor = isInternalFull ? 'border-amber-500/30' : isAutonomous ? 'border-purple-500/30' : isNeural ? 'border-blue-500/30' : 'border-gray-500/30';

  // Trial info - internal_full never has trial
  const trialDaysRemaining = isInternalFull ? 0 : trialEndsAt 
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
    isInternalFull,
    isLoading,

    // Trial status - internal_full is never on trial
    isTrial: isInternalFull ? false : isTrial,
    trialEndsAt: isInternalFull ? null : trialEndsAt,
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
