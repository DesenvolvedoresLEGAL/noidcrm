import { motion } from 'framer-motion';
import { 
  Rocket, 
  Settings, 
  TrendingUp, 
  Brain, 
  ClipboardList, 
  Shield, 
  Plug, 
  HelpCircle,
  FileText,
  LucideIcon 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const iconMap: Record<string, LucideIcon> = {
  Rocket,
  Settings,
  TrendingUp,
  Brain,
  ClipboardList,
  Shield,
  Plug,
  HelpCircle,
  FileText,
};

interface DocsCategoryCardProps {
  name: string;
  description: string;
  icon: string;
  articleCount: number;
  onClick: () => void;
  index: number;
}

const categoryLabels: Record<string, string> = {
  'getting-started': 'Começando com o NOID',
  'configuration': 'Configuração Inicial',
  'sales-revenue': 'Vendas e Revenue',
  'artificial-intelligence': 'Inteligência Artificial',
  'operations': 'Operações e CS',
  'security': 'Segurança e LGPD',
  'integrations': 'Integrações',
  'faq': 'FAQ',
};

export function DocsCategoryCard({
  name,
  description,
  icon,
  articleCount,
  onClick,
  index,
}: DocsCategoryCardProps) {
  const Icon = iconMap[icon] || FileText;
  const displayName = categoryLabels[name] || name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Card
        className="group cursor-pointer h-full transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1"
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {displayName}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {description}
              </p>
              <span className="text-xs text-muted-foreground">
                {articleCount} {articleCount === 1 ? 'artigo' : 'artigos'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
