import { useMemo } from 'react';
import type {
  DashboardProfile,
  DashboardResolutionResult,
  ResolvedDashboardProfile,
} from '@/services/crm/dashboardProfiles';

export type DashboardLayoutType =
  | 'placeholder'
  | 'dynamic_placeholder'
  | 'legacy'
  | 'unknown';

export type ShellMode = 'preview' | 'admin_center' | 'future_runtime';

export interface NormalizedShellWidget {
  key: string;
  label: string;
  status: string;
  description?: string;
  size?: string;
  metadata?: Record<string, any>;
}

export interface NormalizedShell {
  profile: DashboardProfile | ResolvedDashboardProfile | null;
  layoutType: DashboardLayoutType;
  widgets: NormalizedShellWidget[];
  isLegacy: boolean;
  isPlaceholder: boolean;
  isAdminCenter: boolean;
  isOwnerCockpit: boolean;
  isUnsupported: boolean;
  isFallback: boolean;
  badges: string[];
  safeTitle: string;
  safeDescription: string;
  scopeType: string | null;
  scopeKey: string | null;
}

function normalizeLayoutType(layout: any): DashboardLayoutType {
  const t = (layout?.type ?? '').toString().toLowerCase();
  if (t === 'legacy') return 'legacy';
  if (t === 'placeholder' || t === 'dynamic_placeholder') return 'placeholder';
  if (!t) return 'placeholder';
  return 'unknown';
}

function normalizeWidget(raw: any, idx: number): NormalizedShellWidget {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const key = String(safe.key ?? safe.id ?? `widget-${idx}`);
  const label = String(safe.label ?? safe.title ?? key);
  const status = String(safe.status ?? 'placeholder');
  return {
    key,
    label,
    status,
    description: typeof safe.description === 'string' ? safe.description : undefined,
    size: typeof safe.size === 'string' ? safe.size : undefined,
    metadata: typeof safe.metadata === 'object' ? safe.metadata : undefined,
  };
}

export function useDynamicDashboardShell(
  profile: DashboardProfile | ResolvedDashboardProfile | null | undefined,
  options: {
    mode?: ShellMode;
    resolution?: DashboardResolutionResult | null;
  } = {},
): NormalizedShell {
  const { mode = 'preview', resolution = null } = options;

  return useMemo<NormalizedShell>(() => {
    if (!profile) {
      return {
        profile: null,
        layoutType: 'placeholder',
        widgets: [],
        isLegacy: false,
        isPlaceholder: false,
        isAdminCenter: false,
        isOwnerCockpit: false,
        isUnsupported: false,
        isFallback: !!resolution?.fallback_used,
        badges: [],
        safeTitle: '',
        safeDescription: '',
        scopeType: null,
        scopeKey: null,
      };
    }

    const layoutType = normalizeLayoutType(profile.layout);
    const isLegacy = layoutType === 'legacy';
    const isUnsupported = layoutType === 'unknown';
    const isPlaceholder = layoutType === 'placeholder';

    const rawWidgets = Array.isArray(profile.widgets) ? profile.widgets : [];
    const widgets = isLegacy || isUnsupported
      ? []
      : rawWidgets.map(normalizeWidget);

    const metadata = (profile as any).metadata ?? {};
    const isAdminCenter = !!metadata?.is_admin_center;
    const isOwnerCockpit =
      !!metadata?.is_owner_cockpit ||
      resolution?.resolution_source === 'owner_override';
    const isFallback = !!resolution?.fallback_used;

    const badges: string[] = [];
    if (mode === 'preview') badges.push('Preview');
    if (isPlaceholder) badges.push('Placeholder');
    if (isAdminCenter) badges.push('Admin Center');
    if (isOwnerCockpit) badges.push('Owner Cockpit');
    if (isFallback) badges.push('Fallback');

    return {
      profile,
      layoutType,
      widgets,
      isLegacy,
      isPlaceholder,
      isAdminCenter,
      isOwnerCockpit,
      isUnsupported,
      isFallback,
      badges,
      safeTitle: profile.name || profile.key || 'Dashboard',
      safeDescription: profile.description || '',
      scopeType: profile.scope_type ?? null,
      scopeKey: profile.scope_key ?? null,
    };
  }, [profile, mode, resolution]);
}
