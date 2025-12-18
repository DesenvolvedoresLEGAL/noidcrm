import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SettingsBreadcrumb } from '@/components/settings/SettingsBreadcrumb';

// Map paths to breadcrumb labels
const pathToBreadcrumb: Record<string, { label: string; parent?: { label: string; href: string } }> = {
  '/app/settings/profile': { label: 'Perfil' },
  '/app/settings/security': { label: 'Segurança' },
  '/app/settings/organization': { label: 'Dados da Empresa' },
  '/app/settings/users': { label: 'Usuários' },
  '/app/settings/teams': { label: 'Equipes' },
  '/app/settings/permissions': { label: 'Permissões' },
  '/app/settings/billing': { label: 'Meu Plano', parent: { label: 'Faturamento', href: '/app/settings/billing' } },
  '/app/settings/billing/invoices': { label: 'Faturas', parent: { label: 'Faturamento', href: '/app/settings/billing' } },
  '/app/settings/billing/payment': { label: 'Pagamento', parent: { label: 'Faturamento', href: '/app/settings/billing' } },
  '/app/settings/account': { label: 'Conta' },
  '/app/settings/pipelines': { label: 'Funis e Etapas' },
  '/app/settings/business-units': { label: 'Unidades de Negócio' },
  '/app/settings/origins': { label: 'Origens' },
  '/app/settings/loss-reasons': { label: 'Motivos de Perda' },
  '/app/settings/product-categories': { label: 'Categorias' },
  '/app/settings/proposal-layouts': { label: 'Modelos de Proposta' },
  '/app/settings/proposal-settings': { label: 'Configurações de Proposta' },
  '/app/settings/integrations': { label: 'Integrações' },
  '/app/settings/data-management': { label: 'Gestão de Dados' },
  '/app/settings/custom-fields': { label: 'Campos Personalizados' },
  '/app/settings/custom-forms': { label: 'Formulários' },
  '/app/settings/industries': { label: 'Setores' },
};

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get breadcrumb items based on current path
  const getBreadcrumbItems = () => {
    const pathInfo = pathToBreadcrumb[location.pathname];
    if (!pathInfo) return [{ label: 'Configuração' }];
    
    if (pathInfo.parent) {
      return [
        { label: pathInfo.parent.label, href: pathInfo.parent.href },
        { label: pathInfo.label },
      ];
    }
    
    return [{ label: pathInfo.label }];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Left: Back to Settings */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app/settings')}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Configurações</span>
              </Button>
            </div>

            {/* Center: Breadcrumb */}
            <div className="hidden sm:block">
              <SettingsBreadcrumb items={getBreadcrumbItems()} />
            </div>

            {/* Right: Theme Toggle */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Mobile Breadcrumb */}
        <div className="sm:hidden mb-4">
          <SettingsBreadcrumb items={getBreadcrumbItems()} />
        </div>
        
        <Outlet />
      </main>
    </div>
  );
}
