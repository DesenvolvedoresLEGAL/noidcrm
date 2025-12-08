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
  Gauge,
  Package,
  TrendingUp,
  Zap,
  Handshake,
  HeadphonesIcon,
  Settings2,
  Crown,
  Activity,
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
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserProfileMenu } from '@/components/sidebar/UserProfileMenu';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  { path: '/app/intelligence/winloss', label: 'Win/Loss Hub', icon: Activity, requiredLevel: 'partial' },
];

// GTM - Revenue Operating System (Owner only - advanced shortcuts)
// Other users see their dashboard automatically via /app/dashboard routing
const gtmItems: MenuItem[] = [
  { path: '/app/gtm/sdr', label: 'SDR Center', icon: Zap, requiredLevel: 'full' },
  { path: '/app/gtm/ae', label: 'AE Dashboard', icon: Handshake, requiredLevel: 'full' },
  { path: '/app/gtm/cs', label: 'CS Engine', icon: HeadphonesIcon, requiredLevel: 'full' },
  { path: '/app/gtm/revops', label: 'RevOps', icon: Settings2, requiredLevel: 'full' },
  { path: '/app/gtm/manager', label: 'Manager', icon: Users, requiredLevel: 'full' },
  { path: '/app/gtm/ceo', label: 'CEO Cockpit', icon: Crown, requiredLevel: 'full' },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { signOut, user } = useSupabaseAuth();
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
  const filteredGtmItems = gtmItems.filter(item => canAccess(item.requiredLevel));

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
          <Link 
            to={item.path}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" aria-label="Navegação principal">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent">
            NOID CRM
          </h1>
          {open && <NotificationCenter />}
        </div>
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent className="px-2 py-2">
        {/* PRINCIPAL Section */}
        <SidebarGroup role="navigation" aria-label="Menu principal">
          <SidebarMenu>
            {principalItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* GESTÃO Section */}
        <SidebarGroup role="navigation" aria-label="Gestão de entidades">
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
        <SidebarGroup role="navigation" aria-label="Inteligência e relatórios">
          {open && (
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-2 mb-1.5 pt-1">
              Inteligência
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {filteredInteligenciaItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>

        {/* GTM Section - Revenue Operating System */}
        <SidebarGroup role="navigation" aria-label="GTM Revenue OS">
          {open && (
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-2 mb-1.5 pt-1">
              GTM
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {filteredGtmItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer - User Profile Menu */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserProfileMenu
          profile={profile}
          organization={organization}
          userEmail={user?.email}
          roleBadge={roleBadge}
          onLogout={handleLogout}
          collapsed={!open}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
