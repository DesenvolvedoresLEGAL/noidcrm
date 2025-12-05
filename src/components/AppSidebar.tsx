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
  Package,
  TrendingUp,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/NotificationBell';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type AccessLevel = 'basic' | 'partial' | 'full';

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  requiredLevel?: AccessLevel;
}

// PRINCIPAL - Core daily operations
const principalItems: MenuItem[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/opportunities', label: 'Pipeline', icon: Target },
  { path: '/app/activities', label: 'Atividades', icon: CheckSquare },
  { path: '/app/roleplay', label: 'Roleplay', icon: Users },
];

// GESTÃO - Entity management
const gestaoItems: MenuItem[] = [
  { path: '/app/accounts', label: 'Contas', icon: Building2 },
  { path: '/app/proposals', label: 'Propostas', icon: FileText },
  { path: '/app/contracts', label: 'Contratos', icon: FileCheck },
  { path: '/app/products', label: 'Produtos', icon: Package },
];

// INTELIGÊNCIA - Analytics & AI
const inteligenciaItems: MenuItem[] = [
  { path: '/app/forecast', label: 'Forecast', icon: TrendingUp, requiredLevel: 'partial' },
  { path: '/app/scoring', label: 'Scoring', icon: Gauge },
  { path: '/app/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/app/insights', label: 'Insights', icon: Lightbulb },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useSupabaseAuth();
  const { organization } = useCurrentOrganization();
  const { profile } = useUserProfile();
  const { open } = useSidebar();
  const { isOwner, isAdmin, isManager } = usePermissions();

  // Determine user access level
  const getUserAccessLevel = (): AccessLevel => {
    if (isOwner || isAdmin) return 'full';
    if (isManager) return 'partial';
    return 'basic';
  };

  const userLevel = getUserAccessLevel();

  const canAccess = (requiredLevel?: AccessLevel): boolean => {
    if (!requiredLevel) return true;
    const levelHierarchy: Record<AccessLevel, number> = {
      basic: 1,
      partial: 2,
      full: 3,
    };
    return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
  };

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

  const getRoleBadge = () => {
    if (isOwner) return { label: 'Owner', variant: 'default' as const };
    if (isAdmin) return { label: 'Admin', variant: 'secondary' as const };
    if (isManager) return { label: 'Gerente', variant: 'outline' as const };
    return null;
  };

  const roleBadge = getRoleBadge();

  // Filter items based on access level
  const filteredInteligenciaItems = inteligenciaItems.filter(item => canAccess(item.requiredLevel));

  const renderMenuItem = (item: MenuItem) => {
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
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
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

      {/* Main Content */}
      <SidebarContent className="px-2 py-2">
        {/* PRINCIPAL Section */}
        <SidebarGroup>
          <SidebarMenu>
            {principalItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* GESTÃO Section */}
        <SidebarGroup>
          {open && (
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-2 mb-1.5 pt-1">
              Gestão
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {gestaoItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* INTELIGÊNCIA Section */}
        <SidebarGroup>
          {open && (
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-2 mb-1.5 pt-1">
              Inteligência
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {filteredInteligenciaItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
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
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile.full_name?.split(' ')[0] || 'Usuário'}
                </p>
                {roleBadge && (
                  <Badge variant={roleBadge.variant} className="text-[10px] px-1.5 py-0 h-4">
                    {roleBadge.label}
                  </Badge>
                )}
              </div>
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
