import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Workflow, ShieldCheck, ScrollText, BarChart3,
  Wrench, Brain, Server, ArrowRight, Construction, Network, TrendingUp, FlaskConical
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApprovalQueueCount } from '@/hooks/useApprovalQueueCount';

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
    available: true,
  },
  {
    id: 'logs',
    title: 'Logs',
    description: 'Histórico de execuções',
    icon: ScrollText,
    path: '/app/settings/noid-intelligence/logs',
    available: true,
  },
  {
    id: 'metrics',
    title: 'Métricas',
    description: 'Performance dos agentes',
    icon: BarChart3,
    path: '/app/settings/noid-intelligence/metrics',
    available: true,
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
  {
    id: 'mcp-registry',
    title: 'MCP Registry',
    description: 'Governança técnica de tools, contexto e prompts',
    icon: Network,
    path: '/app/settings/noid-intelligence/mcp-registry',
    available: true,
    badge: 'Técnico',
  },
  {
    id: 'decision-rules',
    title: 'Decision Engine',
    description: 'Regras que transformam scores em ações automáticas',
    icon: Workflow,
    path: '/app/settings/noid-intelligence/decision-rules',
    available: true,
    badge: 'Auto',
  },
  {
    id: 'learning',
    title: 'Performance & Aprendizado',
    description: 'Funil, sinais que convertem e performance de outreach',
    icon: TrendingUp,
    path: '/app/settings/noid-intelligence/learning',
    available: true,
    badge: 'Learning',
  },
  {
    id: 'hh-lab',
    title: 'Headless Humanoid Lab',
    description: 'Valide a camada agent-ready (registry, approvals, audit)',
    icon: FlaskConical,
    path: '/app/settings/noid-intelligence/hh-lab',
    available: true,
    badge: 'Lab',
  },
];

export default function NoidIntelligenceHub() {
  const navigate = useNavigate();
  const { data: pendingCount = 0 } = useApprovalQueueCount();

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
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center relative">
                    <item.icon className="h-5 w-5 text-primary" />
                    {item.id === 'approvals' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </div>
                  {item.available ? (
                    item.id === 'approvals' && pendingCount > 0 ? (
                      <Badge variant="destructive" className="text-xs">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">Disponível</Badge>
                    )
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
