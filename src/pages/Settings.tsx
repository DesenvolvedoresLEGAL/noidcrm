import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ThemeToggleCard } from '@/components/ThemeToggleCard';
import { UserProfileCard } from '@/components/UserProfileCard';
import { SecurityCard } from '@/components/SecurityCard';
import { MonthlyGoalCard } from '@/components/settings/MonthlyGoalCard';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Users, 
  Target, 
  FileText, 
  Zap,
  Database,
  Activity
} from 'lucide-react';

const settingsSections = [
  {
    category: 'Conta',
    items: [
      { id: 'conta', label: 'Conta', icon: SettingsIcon, description: 'Informações da empresa' },
      { id: 'configuracoes', label: 'Configurações do Sistema', icon: SettingsIcon, description: 'Exportações, impostos, notas e mais' },
      { id: 'usuarios', label: 'Usuários', icon: Users, description: 'Gerenciar usuários' },
      { id: 'equipes', label: 'Equipes', icon: Users, description: 'Estrutura de equipes' },
    ],
  },
  {
    category: 'Oportunidades',
    items: [
      { id: 'business-units', label: 'Unidades de Negócio', icon: Database, description: 'Configure as unidades' },
      { id: 'funis', label: 'Funis e Etapas', icon: Target, description: 'Configurar pipelines' },
      { id: 'origens', label: 'Origens e Grupos', icon: Database, description: 'Fontes de leads' },
      { id: 'motivos-perda', label: 'Motivos de Perda', icon: Activity, description: 'Categorias de perda' },
    ],
  },
  {
    category: 'Propostas',
    items: [
      { id: 'produtos-servicos', label: 'Produtos/Serviços', icon: FileText, description: 'Catálogo de produtos' },
      { id: 'categorias', label: 'Categorias', icon: Database, description: 'Organização de produtos' },
      { id: 'formas-pagamento', label: 'Formas de Pagamento', icon: FileText, description: 'Opções de pagamento' },
    ],
  },
  {
    category: 'Ferramentas',
    items: [
      { id: 'acoes-automaticas', label: 'Ações Automáticas', icon: Zap, description: 'Automações e triggers' },
      { id: 'cadencias', label: 'Cadências de Funil', icon: Activity, description: 'Sequências de follow-up' },
      { id: 'integracoes', label: 'Integrações', icon: Zap, description: 'Conectar ferramentas' },
      { id: 'data-management', label: 'Gestão de Dados', icon: Database, description: 'Importar e exportar dados' },
    ],
  },
];

export default function Settings() {
  const navigate = useNavigate();

  const handleCardClick = (id: string) => {
    const routes: Record<string, string> = {
      'conta': '/app/settings/account',
      'configuracoes': '/app/settings/system',
      'usuarios': '/app/settings/users',
      'equipes': '/app/settings/teams',
      'funis': '/app/settings/pipelines',
      'business-units': '/app/settings/business-units',
      'integracoes': '/app/settings/integrations',
      'data-management': '/app/settings/data-management',
    };
    
    if (routes[id]) {
      navigate(routes[id]);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Configurações</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie todas as configurações do sistema
          </p>
        </div>

        {/* Seção de Perfil do Usuário */}
        <div className="animate-fade-in space-y-4" style={{ animationDelay: '0ms' }}>
          <h2 className="text-lg font-bold text-foreground">Meu Perfil</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UserProfileCard />
            <SecurityCard />
          </div>
        </div>

        {/* Seção de Metas */}
        <div className="animate-fade-in space-y-4" style={{ animationDelay: '50ms' }}>
          <h2 className="text-lg font-bold text-foreground">Metas de Vendas</h2>
          <MonthlyGoalCard />
        </div>

        {/* Seção de Aparência */}
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Aparência</h2>
          <ThemeToggleCard />
        </div>

        {settingsSections.map((section, sectionIndex) => (
          <div key={section.category} className="space-y-4 animate-fade-in" style={{ animationDelay: `${sectionIndex * 100}ms` }}>
            <h2 className="text-lg font-bold text-foreground">{section.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.id}
                    className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] cursor-pointer group animate-fade-in"
                    style={{ animationDelay: `${(sectionIndex * 100) + (itemIndex * 50)}ms` }}
                    onClick={() => handleCardClick(item.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {item.label}
                          </CardTitle>
                          <CardDescription className="mt-1.5">
                            {item.description}
                          </CardDescription>
                        </div>
                        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
