// NRHS Badge Component - Compact badge for cards and lists

import { Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getNRHSTierConfig, NRHSTier } from '@/services/crm/nrhs-calculator';
import { Skeleton } from '@/components/ui/skeleton';

interface NRHSBadgeProps {
  score: number | null;
  tier: unknown;
  issuesCount?: number;
  blockers?: unknown;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  isLoading?: boolean;
  className?: string;
}

const CANONICAL_TIERS: NRHSTier[] = ['elite', 'healthy', 'risk', 'critical', 'insalubrious'];

function normalizeNRHSBadgeValue(input: unknown): string {
  if (typeof input === 'string') return input;
  if (typeof input === 'number') return String(input);

  if (Array.isArray(input)) {
    const first = input.find(item => typeof item === 'string' || typeof item === 'number');
    return first != null ? String(first) : '';
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const candidate = obj.status ?? obj.tier ?? obj.label ?? obj.name ?? obj.code ?? obj.value;
    return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';
  }

  return '';
}

function normalizeBlockers(blockers: unknown): string[] {
  if (!Array.isArray(blockers)) return [];

  return blockers
    .map(normalizeNRHSBadgeValue)
    .map(value => value.trim())
    .filter(Boolean);
}

export function NRHSBadge({
  score,
  tier,
  issuesCount = 0,
  blockers = [],
  size = 'sm',
  showLabel = false,
  isLoading = false,
  className
}: NRHSBadgeProps) {
  const safeTier = normalizeNRHSBadgeValue(tier).trim().toLowerCase();
  const safeBlockers = normalizeBlockers(blockers);

  if (isLoading) {
    return (
      <Skeleton className={cn(
        "rounded",
        size === 'xs' ? 'h-4 w-10' : size === 'sm' ? 'h-5 w-12' : 'h-6 w-14'
      )} />
    );
  }

  if (score === null || !safeTier) {
    return null;
  }

  // Sprint 1.3 hotfix: tolerate legacy/new tier vocabularies without crashing the page.
  // Map any unknown value (e.g. "attention" emitted by calculate-opportunity-indicators)
  // to the closest canonical tier instead of throwing on undefined config.
  const TIER_ALIASES: Record<string, NRHSTier> = {
    attention: 'risk',
    moderate: 'risk',
    warning: 'risk',
    danger: 'critical',
    bad: 'critical',
    good: 'healthy',
    ok: 'healthy',
    excellent: 'elite',
    top: 'elite',
    worst: 'insalubrious',
  };
  const canonicalTier: NRHSTier =
    CANONICAL_TIERS.includes(safeTier as NRHSTier)
      ? (safeTier as NRHSTier)
      : (TIER_ALIASES[safeTier] ?? 'risk');

  const tierConfig = getNRHSTierConfig(canonicalTier) ?? {
    label: '—',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  };
  const hasBlockers = safeBlockers.length > 0;

  const sizeClasses = size === 'xs'
    ? 'text-[8px] px-1 py-0.5 gap-0.5'
    : size === 'sm' 
      ? 'text-[10px] px-1.5 py-0.5 gap-0.5'
      : 'text-xs px-2 py-1 gap-1';

  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center rounded font-semibold",
              tierConfig.bgColor,
              tierConfig.color,
              sizeClasses,
              hasBlockers && "ring-1 ring-red-500/50",
              className
            )}
          >
            <Shield className={iconSize} />
            <span>{score}</span>
            {showLabel && <span className="ml-0.5">{tierConfig.label}</span>}
            {hasBlockers && (
              <AlertTriangle className={cn(iconSize, "text-red-500 ml-0.5")} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-semibold">
              NRHS {score} • {tierConfig.label}
            </p>
            {issuesCount > 0 && (
              <p className="text-muted-foreground">
                {issuesCount} lacuna{issuesCount > 1 ? 's' : ''} detectada{issuesCount > 1 ? 's' : ''}
              </p>
            )}
            {hasBlockers && (
              <div className="pt-1 border-t border-border/50">
                <p className="text-red-400 font-medium">Blockers:</p>
                <ul className="list-disc pl-4 text-red-400">
                  {safeBlockers.slice(0, 3).map(b => (
                    <li key={b}>{b.replace(/_/g, ' ')}</li>
                  ))}
                  {safeBlockers.length > 3 && (
                    <li>+{safeBlockers.length - 3} mais...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
