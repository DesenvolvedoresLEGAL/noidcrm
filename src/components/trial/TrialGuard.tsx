import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useBillingBlockStatus } from '@/hooks/useBillingBlockStatus';
import { TrialBlockedOverlay } from './TrialBlockedOverlay';
import { TrialWarningBanner } from './TrialWarningBanner';
import { BillingBlockedOverlay } from './BillingBlockedOverlay';

interface TrialGuardProps {
  children: React.ReactNode;
}

/**
 * TrialGuard wraps the application and shows:
 * - Warning banner when trial is expiring soon (7-3 days)
 * - Critical warning when trial is almost over (3-0 days)
 * - Full-screen blocker when trial is expired/blocked
 * - Full-screen blocker when blocked for non-payment
 */
export function TrialGuard({ children }: TrialGuardProps) {
  const { isBlocked: isTrialBlocked, isExpired, isLoading: trialLoading } = useTrialStatus();
  const { isBlocked: isBillingBlocked, isLoading: billingLoading, billingStatus } = useBillingBlockStatus();

  const isLoading = trialLoading || billingLoading;
  
  // Show blocked overlay if trial expired/blocked OR billing blocked
  const showTrialBlocker = !isLoading && (isTrialBlocked || isExpired);
  const showBillingBlocker = !isLoading && isBillingBlocked && !showTrialBlocker;

  return (
    <>
      {/* Warning banner at top */}
      <TrialWarningBanner />
      
      {/* Main content */}
      <div className={(showTrialBlocker || showBillingBlocker) ? 'pointer-events-none select-none blur-sm' : ''}>
        {children}
      </div>
      
      {/* Full-screen blocker for trial */}
      {showTrialBlocker && <TrialBlockedOverlay />}
      
      {/* Full-screen blocker for billing */}
      {showBillingBlocker && <BillingBlockedOverlay billingStatus={billingStatus} />}
    </>
  );
}
