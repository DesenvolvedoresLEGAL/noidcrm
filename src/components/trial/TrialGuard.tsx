import { useTrialStatus } from '@/hooks/useTrialStatus';
import { TrialBlockedOverlay } from './TrialBlockedOverlay';
import { TrialWarningBanner } from './TrialWarningBanner';

interface TrialGuardProps {
  children: React.ReactNode;
}

/**
 * TrialGuard wraps the application and shows:
 * - Warning banner when trial is expiring soon (7-3 days)
 * - Critical warning when trial is almost over (3-0 days)
 * - Full-screen blocker when trial is expired/blocked
 */
export function TrialGuard({ children }: TrialGuardProps) {
  const { isBlocked, isExpired, isLoading } = useTrialStatus();

  // Show blocked overlay if trial expired or blocked
  const showBlocker = !isLoading && (isBlocked || isExpired);

  return (
    <>
      {/* Warning banner at top */}
      <TrialWarningBanner />
      
      {/* Main content */}
      <div className={showBlocker ? 'pointer-events-none select-none blur-sm' : ''}>
        {children}
      </div>
      
      {/* Full-screen blocker */}
      {showBlocker && <TrialBlockedOverlay />}
    </>
  );
}
