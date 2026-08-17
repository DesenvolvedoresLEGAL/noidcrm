import { ReactNode, memo } from 'react';
import { createPortal } from 'react-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { SkipToContent } from '@/components/SkipToContent';
import { CelebrationProvider } from '@/components/CelebrationProvider';
import { HelpCenterDrawer } from '@/components/onboarding/education';
import { RealtimeNotificationListener } from '@/components/notifications/RealtimeNotificationListener';

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

/**
 * Mounted in a portal isolated from <main>. Re-renders here (toast etc.)
 * cannot trigger re-renders of the page content tree.
 */
const IsolatedListeners = memo(function IsolatedListeners() {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <HelpCenterDrawer />
      <RealtimeNotificationListener />
    </>,
    document.body,
  );
});

export function Layout({ children, pageTitle }: LayoutProps) {
  return (
    <CelebrationProvider>
      <SidebarProvider>
        <SkipToContent />
        <div className="flex min-h-screen w-full max-w-full md:overflow-x-visible overflow-x-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col min-w-0 max-w-full md:overflow-x-visible overflow-x-hidden">
            <MobileHeader />
            <main
              id="main-content"
              className="flex-1 overflow-auto min-w-0 max-w-full safe-x safe-bottom"
              role="main"
              aria-label={pageTitle || 'Conteúdo principal'}
            >
              {children}
            </main>

          </SidebarInset>
        </div>
        <IsolatedListeners />
      </SidebarProvider>
    </CelebrationProvider>
  );
}
