import { SidebarTrigger } from '@/components/ui/sidebar';
import { UnifiedNotificationInbox } from '@/components/notifications/UnifiedNotificationInbox';

export function MobileHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 pb-0 md:hidden [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9" />
        <h1 className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent">
          NOID CRM
        </h1>
      </div>
      <UnifiedNotificationInbox />
    </header>
  );
}
