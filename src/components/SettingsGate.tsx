import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from './AccessDenied';

export type AccessLevel = 'full' | 'partial' | 'basic';

interface SettingsGateProps {
  requiredLevel: AccessLevel;
  children: ReactNode;
  fallback?: ReactNode;
  hideIfDenied?: boolean;
}

/**
 * Access level hierarchy:
 * - full: owner, admin (all settings)
 * - partial: manager (team settings, reports, but not critical system settings)
 * - basic: sales, viewer (only personal settings)
 */
export function SettingsGate({ 
  requiredLevel, 
  children, 
  fallback,
  hideIfDenied = false 
}: SettingsGateProps) {
  const { isOwner, isAdmin, isManager, loading } = usePermissions();

  if (loading) {
    return null;
  }

  const userLevel = getUserAccessLevel(isOwner, isAdmin, isManager);
  const hasAccess = checkAccess(userLevel, requiredLevel);

  if (!hasAccess) {
    if (hideIfDenied) return null;
    return fallback ? <>{fallback}</> : <AccessDenied requiredLevel={requiredLevel} />;
  }

  return <>{children}</>;
}

function getUserAccessLevel(isOwner: boolean, isAdmin: boolean, isManager: boolean): AccessLevel {
  if (isOwner || isAdmin) return 'full';
  if (isManager) return 'partial';
  return 'basic';
}

function checkAccess(userLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
  const levelHierarchy: Record<AccessLevel, number> = {
    basic: 1,
    partial: 2,
    full: 3,
  };
  
  return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
}

// Hook for programmatic access checks
export function useAccessLevel(): { level: AccessLevel; loading: boolean } {
  const { isOwner, isAdmin, isManager, loading } = usePermissions();
  
  const level = getUserAccessLevel(isOwner, isAdmin, isManager);
  
  return { level, loading };
}
