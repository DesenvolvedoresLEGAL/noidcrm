import { useState } from 'react';
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
  Sparkles,
  Gauge,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Main menu items (flat structure)
const mainMenuItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/opportunities', label: 'Pipeline', icon: Target },
  { path: '/app/activities', label: 'Atividades', icon: CheckSquare },
  { path: '/app/accounts', label: 'Contas', icon: Building2 },
  { path: '/app/proposals', label: 'Propostas', icon: FileText },
  { path: '/app/contracts', label: 'Contratos', icon: FileCheck },
];

// Analytics submenu items
const analyticsItems = [
  { path: '/app/scoring', label: 'Scoring', icon: Gauge },
  { path: '/app/forecast', label: 'Forecast', icon: BarChart3 },
  { path: '/app/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/app/insights', label: 'Insights', icon: Lightbulb },
];

// Roleplay as featured item
const roleplayItem = { path: '/app/roleplay', label: 'Roleplay', icon: Users };

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useSupabaseAuth();
  const { organization } = useCurrentOrganization();
  const { profile } = useUserProfile();
  const { open } = useSidebar();
  
  // Check if any analytics route is active
  const isAnalyticsActive = analyticsItems.some(item => location.pathname === item.path);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);

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

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      {/* Compact Header */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent">
            NOID CRM
          </h1>
          {open && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate('/app/release-notes')}
                  >
                    <Sparkles className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Novidades</TooltipContent>
              </Tooltip>
              <NotificationBell />
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Content - Flat Menu */}
      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {/* Main menu items */}
          {mainMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className={cn(
                    'transition-all duration-200',
                    active && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                  )}
                >
                  <Link to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {/* Analytics Collapsible Submenu */}
          <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    'transition-all duration-200 w-full',
                    isAnalyticsActive && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="flex-1">Análises</span>
                  {open && (
                    analyticsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {analyticsItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <SidebarMenuSubItem key={item.path}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={active}
                          className={cn(
                            'transition-all duration-200',
                            active && 'bg-primary/10 text-primary font-medium'
                          )}
                        >
                          <Link to={item.path}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {/* Roleplay - Featured */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(roleplayItem.path)}
              className={cn(
                'transition-all duration-200',
                isActive(roleplayItem.path) && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
              )}
            >
              <Link to={roleplayItem.path}>
                <Users className="h-4 w-4" />
                <span>{roleplayItem.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      {/* Footer with User Profile and Settings */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        {profile && organization && open && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/50">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {profile.full_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.full_name?.split(' ')[0] || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{organization.slug}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => navigate('/app/settings')}
                >
                  <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Configurações</TooltipContent>
            </Tooltip>
          </div>
        )}
        
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {open && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
