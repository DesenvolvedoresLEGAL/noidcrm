import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, 
  Shield, 
  Building2, 
  Users, 
  CreditCard, 
  Receipt, 
  Wallet,
  Target, 
  Database, 
  FileText, 
  Bot, 
  Zap,
  Package,
  Layers,
  ChevronRight,
  Settings,
  Activity,
  Link2
} from 'lucide-react';

type AccessLevel = 'full' | 'partial' | 'basic';

interface SettingsSidebarProps {
  userLevel: AccessLevel;
  onNavigate?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  requiredLevel: AccessLevel;
}

interface NavSection {
  title: string;
  icon: any;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'Minha Conta',
    icon: User,
    items: [
      { id: 'profile', label: 'Perfil', icon: User, path: '/app/settings/profile', requiredLevel: 'basic' },
      { id: 'security', label: 'Segurança', icon: Shield, path: '/app/settings/security', requiredLevel: 'basic' },
    ],
  },
  {
    title: 'Organização',
    icon: Building2,
    items: [
      { id: 'organization', label: 'Dados da Empresa', icon: Building2, path: '/app/settings/organization', requiredLevel: 'partial' },
      { id: 'users', label: 'Usuários', icon: Users, path: '/app/settings/users', requiredLevel: 'full' },
      { id: 'teams', label: 'Equipes', icon: Users, path: '/app/settings/teams', requiredLevel: 'partial' },
      { id: 'permissions', label: 'Permissões', icon: Shield, path: '/app/settings/permissions', requiredLevel: 'full' },
    ],
  },
  {
    title: 'Faturamento',
    icon: CreditCard,
    items: [
      { id: 'billing', label: 'Meu Plano', icon: CreditCard, path: '/app/settings/billing', requiredLevel: 'full' },
      { id: 'invoices', label: 'Faturas', icon: Receipt, path: '/app/settings/billing/invoices', requiredLevel: 'full' },
      { id: 'payment', label: 'Pagamento', icon: Wallet, path: '/app/settings/billing/payment', requiredLevel: 'full' },
    ],
  },
  {
    title: 'Sistema',
    icon: Settings,
    items: [
      { id: 'pipelines', label: 'Funis e Etapas', icon: Target, path: '/app/settings/pipelines', requiredLevel: 'partial' },
      { id: 'business-units', label: 'Unidades de Negócio', icon: Layers, path: '/app/settings/business-units', requiredLevel: 'full' },
      { id: 'origins', label: 'Origens', icon: Database, path: '/app/settings/origins', requiredLevel: 'partial' },
      { id: 'loss-reasons', label: 'Motivos de Perda', icon: Activity, path: '/app/settings/loss-reasons', requiredLevel: 'partial' },
      { id: 'products', label: 'Produtos', icon: Package, path: '/app/products', requiredLevel: 'partial' },
      { id: 'categories', label: 'Categorias', icon: Database, path: '/app/settings/product-categories', requiredLevel: 'partial' },
    ],
  },
  {
    title: 'Propostas',
    icon: FileText,
    items: [
      { id: 'proposal-layouts', label: 'Modelos', icon: FileText, path: '/app/settings/proposal-layouts', requiredLevel: 'partial' },
      { id: 'proposal-settings', label: 'Configurações', icon: Settings, path: '/app/settings/proposal-settings', requiredLevel: 'full' },
    ],
  },
  {
    title: 'Automação',
    icon: Bot,
    items: [
      { id: 'automation', label: 'Workflows', icon: Bot, path: '/app/automation', requiredLevel: 'full' },
    ],
  },
  {
    title: 'Integrações',
    icon: Zap,
    items: [
      { id: 'integrations', label: 'Conectores', icon: Link2, path: '/app/settings/integrations', requiredLevel: 'full' },
      { id: 'data-management', label: 'Gestão de Dados', icon: Database, path: '/app/settings/data-management', requiredLevel: 'partial' },
    ],
  },
];

export function SettingsSidebar({ userLevel, onNavigate }: SettingsSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const canAccess = (requiredLevel: AccessLevel): boolean => {
    const levelHierarchy: Record<AccessLevel, number> = {
      basic: 1,
      partial: 2,
      full: 3,
    };
    return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
  };

  const handleNavigation = (path: string, requiredLevel: AccessLevel) => {
    if (!canAccess(requiredLevel)) return;
    navigate(path);
    onNavigate?.();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="py-4">
      <div className="px-4 mb-4">
        <h2 className="text-lg font-bold text-foreground">Configurações</h2>
      </div>

      <div className="space-y-6">
        {navigationSections.map((section) => {
          const SectionIcon = section.icon;
          const hasAccessibleItems = section.items.some(item => canAccess(item.requiredLevel));
          
          if (!hasAccessibleItems) return null;

          return (
            <div key={section.title}>
              <div className="px-4 mb-2 flex items-center gap-2">
                <SectionIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </span>
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const hasAccess = canAccess(item.requiredLevel);
                  const active = isActive(item.path);

                  if (!hasAccess) return null;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNavigation(item.path, item.requiredLevel)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                          'hover:bg-accent/50',
                          active && 'bg-accent text-accent-foreground font-medium',
                          !active && 'text-muted-foreground'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', active && 'text-primary')} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {active && <ChevronRight className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
