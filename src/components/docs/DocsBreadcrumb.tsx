import { ChevronRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DocsBreadcrumbProps {
  items: BreadcrumbItem[];
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

export function DocsBreadcrumb({ items }: DocsBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
      <Link
        to="/app/docs"
        className="flex items-center gap-1.5 hover:text-primary transition-colors"
      >
        <BookOpen className="h-4 w-4" />
        <span>Documentação</span>
      </Link>
      
      {items.map((item, index) => {
        const displayLabel = categoryLabels[item.label] || item.label;
        
        return (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            {item.href ? (
              <Link
                to={item.href}
                className="hover:text-primary transition-colors"
              >
                {displayLabel}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{displayLabel}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
