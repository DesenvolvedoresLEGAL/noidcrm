import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  FileCheck,
  BarChart3,
  Settings,
  LogOut,
  Lightbulb,
  Bot,
  Users,
  Building2,
  Phone,
  Package,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { MobileNav } from '@/components/MobileNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/opportunities', label: 'Pipeline', icon: Target },
    { path: '/app/activities', label: 'Atividades', icon: CheckSquare },
    { path: '/app/accounts', label: 'Contas', icon: Building2 },
    { path: '/app/proposals', label: 'Propostas', icon: FileText },
    { path: '/app/contracts', label: 'Contratos', icon: FileCheck },
    { path: '/app/forecast', label: 'Forecast', icon: BarChart3 },
    { path: '/app/reports', label: 'Relatórios', icon: BarChart3 },
    { path: '/app/insights', label: 'Insights', icon: Lightbulb },
    { path: '/app/roleplay', label: 'Roleplay', icon: Users },
    { path: '/app/settings', label: 'Configurações', icon: Settings },
  ];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useSupabaseAuth();
  const { organization } = useCurrentOrganization();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        toast({
          title: 'Erro ao fazer logout',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Logout realizado com sucesso' });
        navigate('/login', { replace: true });
      }
    } catch (error) {
      toast({
        title: 'Erro ao fazer logout',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col">
        <div className="p-6 border-b border-border space-y-3">
          <h1 className="text-2xl font-black bg-gradient-primary bg-clip-text text-transparent">
            NOID CRM
          </h1>
          
          {profile && organization && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {profile.full_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {profile.full_name?.split(' ')[0] || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{organization.slug}</p>
                </div>
                <NotificationBell />
                {organization.status === 'trial' && (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-warning/10 text-warning">
                    Trial
                  </div>
                )}
              </div>
              {organization.is_plan_locked && (
                <div className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-primary/10 border border-primary/20">
                  <Shield className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary">INTERNAL MODE</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={`w-full justify-start ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
