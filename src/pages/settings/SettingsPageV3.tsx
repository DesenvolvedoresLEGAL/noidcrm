import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Shield, Building2, Users, CreditCard, Receipt, Wallet,
  Target, Database, FileText, Bot, Zap, Package, Layers, Settings,
  Activity, Link2, ChevronRight, Sparkles, Crown, FileCheck, PartyPopper
} from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { SettingsSearch } from '@/components/settings/SettingsSearch';
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard';
import { usePermissions } from '@/hooks/usePermissions';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AccessLevel = 'full' | 'partial' | 'basic';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  path: string;
  requiredLevel: AccessLevel;
  keywords?: string[];
}

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  items: SettingsItem[];
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'account',
    title: 'Minha Conta',
    description: 'Perfil, segurança e preferências pessoais',
    icon: User,
    color: 'from-blue-500/20 to-blue-600/10',
    items: [
      { id: 'profile', label: 'Perfil', description: 'Nome, avatar e informações pessoais', icon: User, path: '/app/settings/profile', requiredLevel: 'basic', keywords: ['nome', 'avatar', 'email', 'telefone'] },
      { id: 'security', label: 'Segurança', description: 'Senha e autenticação', icon: Shield, path: '/app/settings/security', requiredLevel: 'basic', keywords: ['senha', 'password', '2fa', 'autenticação'] },
    ],
  },
  {
    id: 'organization',
    title: 'Organização',
    description: 'Empresa, usuários e permissões',
    icon: Building2,
    color: 'from-purple-500/20 to-purple-600/10',
    items: [
      { id: 'organization', label: 'Dados da Empresa', description: 'Informações da organização', icon: Building2, path: '/app/settings/organization', requiredLevel: 'partial', keywords: ['empresa', 'cnpj', 'razão social'] },
      { id: 'users', label: 'Usuários', description: 'Gerenciar membros da equipe', icon: Users, path: '/app/settings/users', requiredLevel: 'full', keywords: ['usuários', 'membros', 'equipe', 'colaboradores'] },
      { id: 'teams', label: 'Equipes', description: 'Estrutura de times', icon: Users, path: '/app/settings/teams', requiredLevel: 'partial', keywords: ['times', 'equipes', 'grupos'] },
      { id: 'permissions', label: 'Permissões', description: 'Controle de acesso', icon: Shield, path: '/app/settings/permissions', requiredLevel: 'full', keywords: ['permissões', 'acesso', 'roles'] },
    ],
  },
  {
    id: 'billing',
    title: 'Faturamento',
    description: 'Plano, pagamentos e faturas',
    icon: CreditCard,
    color: 'from-emerald-500/20 to-emerald-600/10',
    items: [
      { id: 'billing', label: 'Meu Plano', description: 'Gerencie sua assinatura', icon: CreditCard, path: '/app/settings/billing', requiredLevel: 'full', keywords: ['plano', 'assinatura', 'subscription'] },
      { id: 'invoices', label: 'Faturas', description: 'Histórico de pagamentos', icon: Receipt, path: '/app/settings/billing/invoices', requiredLevel: 'full', keywords: ['faturas', 'notas', 'pagamentos'] },
      { id: 'payment', label: 'Pagamento', description: 'Métodos de pagamento', icon: Wallet, path: '/app/settings/billing/payment', requiredLevel: 'full', keywords: ['cartão', 'pix', 'boleto'] },
    ],
  },
  {
    id: 'system',
    title: 'Sistema',
    description: 'Funis, produtos e configurações gerais',
    icon: Settings,
    color: 'from-orange-500/20 to-orange-600/10',
    items: [
      { id: 'pipelines', label: 'Funis e Etapas', description: 'Configure seus pipelines', icon: Target, path: '/app/settings/pipelines', requiredLevel: 'partial', keywords: ['funil', 'pipeline', 'etapas', 'stages'] },
      { id: 'business-units', label: 'Unidades de Negócio', description: 'Divisões da empresa', icon: Layers, path: '/app/settings/business-units', requiredLevel: 'full', keywords: ['unidade', 'divisão', 'departamento'] },
      { id: 'origins', label: 'Origens', description: 'Fontes de leads', icon: Database, path: '/app/settings/origins', requiredLevel: 'partial', keywords: ['origem', 'fonte', 'lead source'] },
      { id: 'loss-reasons', label: 'Motivos de Perda', description: 'Razões de não-fechamento', icon: Activity, path: '/app/settings/loss-reasons', requiredLevel: 'partial', keywords: ['perda', 'motivo', 'loss reason'] },
      { id: 'products', label: 'Produtos', description: 'Catálogo de produtos', icon: Package, path: '/app/products', requiredLevel: 'partial', keywords: ['produto', 'serviço', 'item'] },
      { id: 'categories', label: 'Categorias', description: 'Categorias de produtos', icon: Database, path: '/app/settings/product-categories', requiredLevel: 'partial', keywords: ['categoria', 'tipo'] },
      { id: 'custom-fields', label: 'Campos Personalizados', description: 'Campos customizados para entidades', icon: Layers, path: '/app/settings/custom-fields', requiredLevel: 'partial', keywords: ['campo', 'customizado', 'personalizado', 'variável'] },
      { id: 'custom-forms', label: 'Formulários', description: 'Checklists e formulários personalizados', icon: FileCheck, path: '/app/settings/custom-forms', requiredLevel: 'partial', keywords: ['formulário', 'checklist', 'form'] },
      { id: 'celebracoes', label: 'Celebrações', description: 'Confetes e sons ao fechar vendas', icon: PartyPopper, path: '/app/settings/system/celebracoes', requiredLevel: 'full', keywords: ['celebração', 'confete', 'som', 'experiência', 'comemoração'] },
    ],
  },
  {
    id: 'proposals',
    title: 'Propostas',
    description: 'Modelos e configurações de propostas',
    icon: FileText,
    color: 'from-cyan-500/20 to-cyan-600/10',
    items: [
      { id: 'proposal-layouts', label: 'Modelos', description: 'Templates de propostas', icon: FileText, path: '/app/settings/proposal-layouts', requiredLevel: 'partial', keywords: ['modelo', 'template', 'layout'] },
      { id: 'proposal-settings', label: 'Configurações', description: 'Opções de propostas', icon: Settings, path: '/app/settings/proposal-settings', requiredLevel: 'full', keywords: ['configuração', 'opções'] },
    ],
  },
  {
    id: 'automation',
    title: 'Automação',
    description: 'Workflows e regras automáticas',
    icon: Bot,
    color: 'from-pink-500/20 to-pink-600/10',
    items: [
      { id: 'automation', label: 'Workflows', description: 'Regras de automação', icon: Bot, path: '/app/automation', requiredLevel: 'full', keywords: ['automação', 'workflow', 'regra'] },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrações',
    description: 'Conectores e importação de dados',
    icon: Zap,
    color: 'from-yellow-500/20 to-yellow-600/10',
    items: [
      { id: 'integrations', label: 'Conectores', description: 'APIs e integrações', icon: Link2, path: '/app/settings/integrations', requiredLevel: 'full', keywords: ['integração', 'api', 'conector'] },
      { id: 'data-management', label: 'Gestão de Dados', description: 'Importação e exportação', icon: Database, path: '/app/settings/data-management', requiredLevel: 'partial', keywords: ['dados', 'importar', 'exportar', 'csv'] },
    ],
  },
];

export default function SettingsPageV3() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { isOwner, isAdmin, isManager } = usePermissions();
  const { planId, isTrial, trialEndsAt } = useEntitlements();

  const userLevel: AccessLevel = useMemo(() => {
    if (isOwner || isAdmin) return 'full';
    if (isManager) return 'partial';
    return 'basic';
  }, [isOwner, isAdmin, isManager]);

  const canAccess = (requiredLevel: AccessLevel): boolean => {
    const levelHierarchy: Record<AccessLevel, number> = {
      basic: 1,
      partial: 2,
      full: 3,
    };
    return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return settingsCategories.map(category => ({
        ...category,
        items: category.items.filter(item => canAccess(item.requiredLevel)),
      })).filter(category => category.items.length > 0);
    }

    const query = searchQuery.toLowerCase();
    return settingsCategories.map(category => ({
      ...category,
      items: category.items.filter(item => {
        if (!canAccess(item.requiredLevel)) return false;
        const matchesLabel = item.label.toLowerCase().includes(query);
        const matchesDescription = item.description.toLowerCase().includes(query);
        const matchesKeywords = item.keywords?.some(k => k.toLowerCase().includes(query));
        return matchesLabel || matchesDescription || matchesKeywords;
      }),
    })).filter(category => category.items.length > 0);
  }, [searchQuery, userLevel]);

  const getPlanDisplayName = () => {
    switch (planId) {
      case 'neural': return 'Neural';
      case 'internal_full': return 'Pro';
      case 'freemium':
      case 'free':
      default: 
        return 'Free';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background">
      <SettingsHeader />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Search */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
              <p className="text-muted-foreground mt-1">Gerencie todas as configurações do sistema</p>
            </div>
            {/* Plan Badge */}
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "px-3 py-1 text-sm font-medium",
                  planId === 'neural' && "border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                  planId === 'internal_full' && "border-primary/50 bg-primary/10 text-primary",
                  (planId === 'freemium' || planId === 'free' || !planId) && "border-muted-foreground/50 bg-muted/50 text-muted-foreground",
                )}
              >
                {planId === 'neural' && <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {planId === 'internal_full' && <Crown className="h-3.5 w-3.5 mr-1" />}
                Plano {getPlanDisplayName()}
                {isTrial && <span className="ml-1 text-xs opacity-75">(Trial)</span>}
              </Badge>
            </div>
          </div>

          <SettingsSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Categories Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-6 md:grid-cols-2"
        >
          {filteredCategories.map((category) => (
            <motion.div key={category.id} variants={itemVariants}>
              <SettingsCategoryCard
                category={category}
                onNavigate={(path) => navigate(path)}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredCategories.length === 0 && searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Settings className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum resultado encontrado
            </h3>
            <p className="text-muted-foreground">
              Tente buscar por outro termo ou explore as categorias disponíveis
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
