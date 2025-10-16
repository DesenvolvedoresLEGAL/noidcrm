import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
      { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon, description: 'Configurações gerais' },
      { id: 'usuarios', label: 'Usuários', icon: Users, description: 'Gerenciar usuários' },
      { id: 'equipes', label: 'Equipes', icon: Users, description: 'Estrutura de equipes' },
    ],
  },
  {
    category: 'Oportunidades',
    items: [
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
    ],
  },
];

export default function Settings() {
  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as configurações do sistema
          </p>
        </div>

        {settingsSections.map((section) => (
          <div key={section.category} className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">{section.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.id}
                    className="shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
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
