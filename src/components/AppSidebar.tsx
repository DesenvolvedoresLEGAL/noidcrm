import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Building2,
  FileCheck,
  FileText,
  BarChart3,
  Lightbulb,
  Users,
  Gauge,
  
  Zap,
  Handshake,
  HeadphonesIcon,
  Settings2,
  Crown,
  Activity,
  DollarSign,
  Network,
  Brain,
  BookOpen,
  
  Sparkles,
  Compass,
  Boxes,
  Radar,
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
import { UnifiedNotificationInbox } from '@/components/notifications/UnifiedNotificationInbox';
import { UserProfileMenu } from '@/components/sidebar/UserProfileMenu';
import { SidebarOnboardingTour } from '@/components/sidebar/SidebarOnboardingTour';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { prefetchRoute } from '@/lib/sidebarPrefetch';

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  section: string; // Which menu section this belongs to
}

// All menu items organized by section
const ALL_MENU_ITEMS: MenuItem[] = [
  // PRINCIPAL (sem label)
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'principal' },
  { path: '/app/opportunities', label: 'Pipeline', icon: Target, section: 'principal' },

  // GESTÃO
  { path: '/app/activities', label: 'Atividades', icon: CheckSquare, section: 'gestao' },
  { path: '/app/accounts', label: 'Contas', icon: Building2, section: 'gestao' },
  { path: '/app/contracts', label: 'Contratos', icon: FileCheck, section: 'gestao' },
  { path: '/app/proposals', label: 'Propostas', icon: FileText, section: 'gestao' },

  // REVOPS
  { path: '/app/revenue-command', label: 'Revenue Command', icon: Radar, section: 'revops' },
  // Sprint RCC V3.9 — Forecast e Desempenho ocultados da navegação principal
  // por já terem leitura executiva consolidada no Revenue Command.
  // As rotas continuam acessíveis em /app/forecast e /app/objetivos/desempenho.
  { path: '/app/intelligence/winloss', label: 'Win/Loss Hub', icon: Activity, section: 'revops' },
  { path: '/app/scoring', label: 'Scoring', icon: Gauge, section: 'revops' },

  // GTM
  { path: '/app/intelligence/kairos', label: 'Kairós', icon: Compass, section: 'gtm' },
  { path: '/app/gtm/sdr', label: 'SDR Center', icon: Zap, section: 'gtm' },
  { path: '/app/gtm/ae', label: 'AE Dashboard', icon: Handshake, section: 'gtm' },
  { path: '/app/intelligence/vibe', label: 'Vibe Selling', icon: Sparkles, section: 'gtm' },
  { path: '/app/intelligence/playbooks', label: 'Playbooks', icon: BookOpen, section: 'gtm' },
  { path: '/app/roleplay', label: 'Roleplay', icon: Users, section: 'gtm' },

  // INTELIGÊNCIA
  { path: '/app/insights', label: 'Insights', icon: Lightbulb, section: 'inteligencia' },
  { path: '/app/intelligence/graph', label: 'Knowledge Graph', icon: Network, section: 'inteligencia' },
  { path: '/app/intelligence/memories', label: 'Memórias', icon: Brain, section: 'inteligencia' },

  // OBJETIVOS
  { path: '/app/reports/ote', label: 'Resultados', icon: DollarSign, section: 'objetivos' },
  // Sprint RCC V3.9 — Desempenho ocultado da navegação principal (migrado para RCC → Pessoas).
  { path: '/app/settings/sales', label: 'Configurações', icon: Settings2, section: 'objetivos' },

  // OPERAÇÕES
  { path: '/app/operations/inventory', label: 'Inventário', icon: Boxes, section: 'operacoes' },
];

const SECTION_LABELS: Record<string, string> = {
  principal: '',
  gestao: 'Gestão',
  revops: 'RevOps',
  gtm: 'GTM',
  inteligencia: 'Inteligência',
  objetivos: 'Objetivos',
  operacoes: 'Operações',
};

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { signOut, user } = useSupabaseAuth();
  const { organization } = useCurrentOrganization();
  const { profile } = useUserProfile();
  const { open } = useSidebar();
  const { isOwner, isAdmin, isManager, visibleMenuItems } = usePermissions();
  const queryClient = useQueryClient();
  const organizationId = organization?.id ?? null;

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        toast({
          title: 'Erro ao fazer logout',
          variant: 'destructive',
        });
      } else {
        // AUTH.1.2: limpar cache do React Query antes de navegar (sem reload).
        queryClient.clear();
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

  // Filter items based on visibleMenuItems - controle granular por item individual
  const getItemsForSection = (section: string) => {
    const sectionItems = ALL_MENU_ITEMS.filter(item => item.section === section);
    
    // Owner/Admin vêem TUDO (wildcard)
    if (isOwner || isAdmin || visibleMenuItems.includes('*')) {
      return sectionItems;
    }
    
    // Outros papéis - filtrar por item individual
    return sectionItems.filter(item => visibleMenuItems.includes(item.path));
  };

  const principalItems = getItemsForSection('principal');
  const gestaoItems = getItemsForSection('gestao');
  const revopsItems = getItemsForSection('revops');
  const gtmItems = getItemsForSection('gtm');
  const inteligenciaItems = getItemsForSection('inteligencia');
  const objetivosItems = getItemsForSection('objetivos');
  const operacoesItems = getItemsForSection('operacoes');

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    const handlePrefetch = () => {
      prefetchRoute(queryClient, item.path, organizationId);
    };

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
            onMouseEnter={handlePrefetch}
            onFocus={handlePrefetch}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderSection = (items: MenuItem[], label: string, sectionKey: string) => {
    if (items.length === 0) return null;

    return (
      <SidebarGroup 
        role="navigation" 
        aria-label={label || 'Menu principal'}
        data-tour={`section-${sectionKey}`}
      >
        {open && label && (
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-2 mb-1.5 pt-1">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarMenu>
          {items.map(renderMenuItem)}
        </SidebarMenu>
      </SidebarGroup>
    );
  };

  return (
    <>
      <Sidebar collapsible="icon" aria-label="Navegação principal">
        {/* Header */}
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4" data-tour="sidebar-header">
          <div className="flex items-center justify-between">
            {open && (
              <h1 className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent">
                NOID CRM
              </h1>
            )}
            <UnifiedNotificationInbox collapsed={!open} />
          </div>
        </SidebarHeader>

        {/* Main Content */}
        <SidebarContent className="px-2 py-2">
          {renderSection(principalItems, SECTION_LABELS.principal, 'principal')}
          {renderSection(gestaoItems, SECTION_LABELS.gestao, 'gestao')}
          {renderSection(revopsItems, SECTION_LABELS.revops, 'revops')}
          {renderSection(gtmItems, SECTION_LABELS.gtm, 'gtm')}
          {renderSection(inteligenciaItems, SECTION_LABELS.inteligencia, 'inteligencia')}
          {renderSection(objetivosItems, SECTION_LABELS.objetivos, 'objetivos')}
          {renderSection(operacoesItems, SECTION_LABELS.operacoes, 'operacoes')}
        </SidebarContent>

        {/* Footer - User Profile Menu */}
        <SidebarFooter className="border-t border-sidebar-border p-2" data-tour="sidebar-footer">
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

      {/* Onboarding Tour */}
      <SidebarOnboardingTour sidebarOpen={open} />
    </>
  );
}
