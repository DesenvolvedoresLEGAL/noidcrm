import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ThemeToggleCard } from '@/components/ThemeToggleCard';
import { UserProfileCard } from '@/components/UserProfileCard';
import { SecurityCard } from '@/components/SecurityCard';
import { MonthlyGoalCard } from '@/components/settings/MonthlyGoalCard';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { 
  Settings as SettingsIcon, 
  Users, 
  Target, 
  FileText, 
  Zap,
  Database,
  Activity,
  Package,
  Bot
} from 'lucide-react';

type AccessLevel = 'full' | 'partial' | 'basic';

interface SettingsItem {
  id: string;
  label: string;
  icon: any;
  description: string;
  requiredLevel: AccessLevel;
}

interface SettingsSection {
  category: string;
  items: SettingsItem[];
}

const settingsSections: SettingsSection[] = [
  {
    category: 'Conta',
    items: [
      { id: 'conta', label: 'Conta', icon: SettingsIcon, description: 'Informações da empresa', requiredLevel: 'partial' },
      { id: 'configuracoes', label: 'Configurações do Sistema', icon: SettingsIcon, description: 'Exportações, impostos, notas e mais', requiredLevel: 'full' },
      { id: 'usuarios', label: 'Usuários', icon: Users, description: 'Gerenciar usuários', requiredLevel: 'full' },
      { id: 'permissoes', label: 'Permissões', icon: Users, description: 'Conjuntos de permissões e acessos', requiredLevel: 'full' },
      { id: 'equipes', label: 'Equipes', icon: Users, description: 'Estrutura de equipes', requiredLevel: 'partial' },
      { id: 'custom-fields', label: 'Campos Personalizados', icon: Database, description: 'Variáveis e campos customizados', requiredLevel: 'full' },
      { id: 'custom-forms', label: 'Formulários Personalizados', icon: Database, description: 'Checklists e formulários', requiredLevel: 'full' },
    ],
  },
  {
    category: 'Vendas',
    items: [
      { id: 'sales-config', label: 'Painel de Controle', icon: Target, description: 'Taxas de conversão e metas globais', requiredLevel: 'full' },
      { id: 'seller-targets', label: 'Metas por Vendedor', icon: Users, description: 'Metas individuais e diárias', requiredLevel: 'partial' },
    ],
  },
  {
    category: 'Oportunidades',
    items: [
      { id: 'business-units', label: 'Unidades de Negócio', icon: Database, description: 'Configure as unidades', requiredLevel: 'full' },
      { id: 'funis', label: 'Funis e Etapas', icon: Target, description: 'Configurar pipelines', requiredLevel: 'partial' },
      { id: 'origens', label: 'Origens e Grupos', icon: Database, description: 'Fontes de leads', requiredLevel: 'partial' },
      { id: 'motivos-perda', label: 'Motivos de Perda', icon: Activity, description: 'Categorias de perda', requiredLevel: 'partial' },
    ],
  },
  {
    category: 'Produtos e Serviços',
    items: [
      { id: 'produtos', label: 'Produtos', icon: Package, description: 'Gerenciar catálogo de produtos', requiredLevel: 'partial' },
    ],
  },
  {
    category: 'Propostas',
    items: [
      { id: 'modelos-proposta', label: 'Modelos de Proposta', icon: FileText, description: 'Layouts visuais (PDFs)', requiredLevel: 'partial' },
      { id: 'configuracoes-propostas', label: 'Configurações de Propostas', icon: SettingsIcon, description: 'Moeda, numeração e validade', requiredLevel: 'full' },
      { id: 'categorias', label: 'Categorias', icon: Database, description: 'Organização de produtos', requiredLevel: 'partial' },
    ],
  },
  {
    category: 'Automação',
    items: [
      { id: 'automacao', label: 'Automação', icon: Bot, description: 'Ações automáticas e cadências', requiredLevel: 'full' },
    ],
  },
  {
    category: 'Ferramentas',
    items: [
      { id: 'integracoes', label: 'Integrações', icon: Zap, description: 'Conectar ferramentas', requiredLevel: 'full' },
      { id: 'data-management', label: 'Gestão de Dados', icon: Database, description: 'Importar e exportar dados', requiredLevel: 'partial' },
    ],
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { isOwner, isAdmin, isManager, loading } = usePermissions();

  // Determine user access level
  const getUserAccessLevel = (): AccessLevel => {
    if (isOwner || isAdmin) return 'full';
    if (isManager) return 'partial';
    return 'basic';
  };

  const userLevel = getUserAccessLevel();

  const canAccess = (requiredLevel: AccessLevel): boolean => {
    const levelHierarchy: Record<AccessLevel, number> = {
      basic: 1,
      partial: 2,
      full: 3,
    };
    return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
  };

  const handleCardClick = (id: string, requiredLevel: AccessLevel) => {
    if (!canAccess(requiredLevel)) return;

    const routes: Record<string, string> = {
      'conta': '/app/settings/account',
      'configuracoes': '/app/settings/system',
      'usuarios': '/app/settings/users',
      'permissoes': '/app/settings/permissions',
      'equipes': '/app/settings/teams',
      'funis': '/app/settings/pipelines',
      'business-units': '/app/settings/business-units',
      'integracoes': '/app/settings/integrations',
      'data-management': '/app/settings/data-management',
      'produtos': '/app/products',
      'automacao': '/app/automation',
      'origens': '/app/settings/origins',
      'categorias': '/app/settings/product-categories',
      'motivos-perda': '/app/settings/loss-reasons',
      'modelos-proposta': '/app/settings/proposal-layouts',
      'configuracoes-propostas': '/app/settings/proposal-settings',
      'custom-fields': '/app/settings/custom-fields',
      'custom-forms': '/app/settings/custom-forms',
      'sales-config': '/app/settings/sales-config',
      'seller-targets': '/app/settings/seller-targets',
    };
    
    if (routes[id]) {
      navigate(routes[id]);
    }
  };

  // Filter sections to only show items user can see (at least basic)
  const filteredSections = settingsSections.map(section => ({
    ...section,
    items: section.items, // Show all items, but disable ones without access
  })).filter(section => section.items.length > 0);

  const getRoleBadgeText = () => {
    if (isOwner) return 'Owner';
    if (isAdmin) return 'Admin';
    if (isManager) return 'Gerente';
    return 'Vendedor';
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="animate-fade-in flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Configurações</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie todas as configurações do sistema
            </p>
          </div>
          {!loading && (
            <Badge variant="outline" className="text-xs">
              {getRoleBadgeText()}
            </Badge>
          )}
        </div>

        {/* Seção de Perfil do Usuário - Always visible */}
        <div className="animate-fade-in space-y-4" style={{ animationDelay: '0ms' }}>
          <h2 className="text-lg font-bold text-foreground">Meu Perfil</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UserProfileCard />
            <SecurityCard />
          </div>
        </div>

        {/* Seção de Metas - Only for sales and manager roles */}
        {!isOwner && !isAdmin && (
          <div className="animate-fade-in space-y-4" style={{ animationDelay: '50ms' }}>
            <h2 className="text-lg font-bold text-foreground">Metas de Vendas</h2>
            <MonthlyGoalCard />
          </div>
        )}

        {/* Seção de Aparência - Always visible */}
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Aparência</h2>
          <ThemeToggleCard />
        </div>

        {filteredSections.map((section, sectionIndex) => (
          <div key={section.category} className="space-y-4 animate-fade-in" style={{ animationDelay: `${sectionIndex * 100}ms` }}>
            <h2 className="text-lg font-bold text-foreground">{section.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                const hasAccess = canAccess(item.requiredLevel);
                
                return (
                  <Card
                    key={item.id}
                    className={`shadow-card transition-all duration-300 animate-fade-in ${
                      hasAccess 
                        ? 'hover:shadow-card-hover hover:scale-[1.02] cursor-pointer group'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{ animationDelay: `${(sectionIndex * 100) + (itemIndex * 50)}ms` }}
                    onClick={() => handleCardClick(item.id, item.requiredLevel)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className={`text-base ${hasAccess ? 'group-hover:text-primary' : ''} transition-colors`}>
                              {item.label}
                            </CardTitle>
                            {!hasAccess && (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <CardDescription className="mt-1.5">
                            {item.description}
                          </CardDescription>
                        </div>
                        <Icon className={`h-5 w-5 text-muted-foreground ${hasAccess ? 'group-hover:text-primary' : ''} transition-colors`} />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
