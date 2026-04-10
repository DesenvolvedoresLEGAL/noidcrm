import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Workflow, ShieldCheck, ScrollText, BarChart3,
  Wrench, Brain, Server, ArrowRight, Construction
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const hubItems = [
  {
    id: 'agents',
    title: 'Agentes',
    description: 'Crie e gerencie agentes inteligentes',
    icon: Bot,
    path: '/app/settings/noid-intelligence/agents',
    available: true,
  },
  {
    id: 'orchestrations',
    title: 'Orquestrações',
    description: 'Coordene múltiplos agentes',
    icon: Workflow,
    path: '/app/settings/noid-intelligence/orchestrations',
    available: false,
  },
  {
    id: 'approvals',
    title: 'Aprovações',
    description: 'Fila de aprovação de ações',
    icon: ShieldCheck,
    path: '/app/settings/noid-intelligence/approvals',
    available: false,
  },
  {
    id: 'logs',
    title: 'Logs',
    description: 'Histórico de execuções',
    icon: ScrollText,
    path: '/app/settings/noid-intelligence/logs',
    available: false,
  },
  {
    id: 'metrics',
    title: 'Métricas',
    description: 'Performance dos agentes',
    icon: BarChart3,
    path: '/app/settings/noid-intelligence/metrics',
    available: false,
  },
  {
    id: 'tools',
    title: 'Ferramentas',
    description: 'Tools e actions disponíveis',
    icon: Wrench,
    path: '/app/settings/noid-intelligence/tools',
    available: false,
  },
  {
    id: 'memories',
    title: 'Memórias',
    description: 'Conhecimento persistente',
    icon: Brain,
    path: '/app/settings/noid-intelligence/memories',
    available: false,
  },
  {
    id: 'environments',
    title: 'Ambientes',
    description: 'Configurações de ambiente',
    icon: Server,
    path: '/app/settings/noid-intelligence/environments',
    available: true,
  },
  {
    id: 'permissions',
    title: 'Permissões',
    description: 'Controle de acesso aos agentes',
    icon: ShieldCheck,
    path: '/app/settings/noid-intelligence/permissions',
    available: true,
  },
];

export default function NoidIntelligenceHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">NOID Intelligence</h1>
        <p className="text-muted-foreground mt-1">
          Central de Agentes, Workflows e Automações
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {hubItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                item.available
                  ? 'hover:border-primary/40'
                  : 'opacity-70'
              }`}
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  {item.available ? (
                    <Badge variant="default" className="text-xs">Disponível</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Construction className="h-3 w-3" />
                      Em breve
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.available && (
                  <div className="flex items-center text-xs text-primary font-medium mt-1">
                    Acessar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
