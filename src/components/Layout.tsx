import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { SkipToContent } from '@/components/SkipToContent';
import { CelebrationProvider } from '@/components/CelebrationProvider';
import { HelpCenterDrawer } from '@/components/onboarding/education';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { RealtimeNotificationListener } from '@/components/notifications/RealtimeNotificationListener';

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function Layout({ children, pageTitle }: LayoutProps) {
  return (
    <CelebrationProvider>
      <SidebarProvider>
        <SkipToContent />
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col min-w-0">
            <MobileHeader />
            {/* Desktop notification bell */}
            <div className="hidden md:flex items-center justify-end h-10 px-4 border-b border-border bg-background shrink-0">
              <NotificationCenter />
            </div>
            <main 
              id="main-content" 
              className="flex-1 overflow-auto min-w-0"
              role="main"
              aria-label={pageTitle || 'Conteúdo principal'}
            >
              {children}
            </main>
          </SidebarInset>
        </div>
        <HelpCenterDrawer />
        <RealtimeNotificationListener />
      </SidebarProvider>
    </CelebrationProvider>
  );
}
