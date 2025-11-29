import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Building2,
  FileText,
  FileCheck,
  BarChart3,
  Lightbulb,
  Users,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const menuGroups = [
  {
    label: 'Principal',
    items: [
      { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/app/opportunities', label: 'Pipeline', icon: Target },
      { path: '/app/activities', label: 'Atividades', icon: CheckSquare },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { path: '/app/accounts', label: 'Contas', icon: Building2 },
      { path: '/app/proposals', label: 'Propostas', icon: FileText },
      { path: '/app/contracts', label: 'Contratos', icon: FileCheck },
    ],
  },
  {
    label: 'Análises',
    items: [
      { path: '/app/forecast', label: 'Forecast', icon: BarChart3 },
      { path: '/app/reports', label: 'Relatórios', icon: BarChart3 },
      { path: '/app/insights', label: 'Insights', icon: Lightbulb },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { path: '/app/roleplay', label: 'Roleplay', icon: Users },
      { path: '/app/settings', label: 'Configurações', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useSupabaseAuth();
  const { organization } = useCurrentOrganization();
  const { profile } = useUserProfile();
  const { open } = useSidebar();

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        toast({
          title: 'Erro ao fazer logout',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Logout realizado com sucesso' });
        navigate('/login', { replace: true });
      }
    } catch (error) {
      toast({
        title: 'Erro ao fazer logout',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black bg-gradient-primary bg-clip-text text-transparent">
              NOID CRM
            </h1>
          </div>
          {open && <NotificationBell />}
        </div>

        {profile && organization && open && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent border border-sidebar-border">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {profile.full_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {profile.full_name?.split(' ')[0] || 'Usuário'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{organization.slug}
                </p>
              </div>
            </div>

            {organization.status === 'trial' && (
              <div className="px-3 py-1.5 rounded-md text-xs font-medium bg-warning/10 text-warning border border-warning/20 text-center">
                Período Trial
              </div>
            )}

            {organization.is_plan_locked && (
              <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">INTERNAL MODE</span>
              </div>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          'transition-all duration-200',
                          isActive && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                        )}
                      >
                        <Link to={item.path}>
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          {open && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
