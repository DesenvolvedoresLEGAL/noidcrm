import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { useUserProfile } from '@/hooks/useUserProfile';

export function MobileHeader() {
  const { profile } = useUserProfile();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9" />
        <h1 className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent">
          NOID CRM
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
