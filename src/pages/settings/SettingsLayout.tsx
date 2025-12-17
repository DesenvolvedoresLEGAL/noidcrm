import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOwner, isAdmin, isManager, loading } = usePermissions();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Get user access level
  const getUserAccessLevel = () => {
    if (isOwner || isAdmin) return 'full';
    if (isManager) return 'partial';
    return 'basic';
  };

  const userLevel = getUserAccessLevel();

  const getRoleBadgeText = () => {
    if (isOwner) return 'Owner';
    if (isAdmin) return 'Admin';
    if (isManager) return 'Gerente';
    return 'Vendedor';
  };

  // Redirect to profile if at /app/settings exactly
  useEffect(() => {
    if (location.pathname === '/app/settings') {
      navigate('/app/settings/profile', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 border-r border-border bg-card/50 overflow-y-auto">
          <SettingsSidebar userLevel={userLevel} onNavigate={() => {}} />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SettingsSidebar 
              userLevel={userLevel} 
              onNavigate={() => setIsMobileOpen(false)} 
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {/* Mobile Header */}
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-bold">Configurações</h1>
              </div>
              {!loading && (
                <Badge variant="outline" className="text-xs">
                  {getRoleBadgeText()}
                </Badge>
              )}
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie todas as configurações do sistema
                </p>
              </div>
              {!loading && (
                <Badge variant="outline" className="text-xs">
                  {getRoleBadgeText()}
                </Badge>
              )}
            </div>

            {/* Nested Routes Content */}
            <Outlet />
          </div>
        </div>
      </div>
    </Layout>
  );
}
