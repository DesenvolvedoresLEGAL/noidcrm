import { useEffect, useState } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSalesTips, SalesTip } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function SalesTipCard() {
  const [tips, setTips] = useState<SalesTip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSalesTips().then(result => {
      setTips(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (tips.length === 0) return null;

  const currentTip = tips[currentIndex];

  const nextTip = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const prevTip = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      closing: 'Fechamento',
      objection: 'Objeções',
      prospecting: 'Prospecção',
      negotiation: 'Negociação'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      closing: 'bg-green-500/10 text-green-500 border-green-500/20',
      objection: 'bg-red-500/10 text-red-500 border-red-500/20',
      prospecting: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      negotiation: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  return (
    <InsightCard
      title="Dica de Vendas do Dia"
      description="Técnicas práticas para aplicar hoje"
      icon={Lightbulb}
      iconColor="text-blue-500"
      headerAction={
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={prevTip}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {currentIndex + 1} / {tips.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={nextTip}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in" key={currentIndex}>
        {/* Category Badge */}
        <Badge className={getCategoryColor(currentTip.category)}>
          {getCategoryLabel(currentTip.category)}
        </Badge>

        {/* Tip Title */}
        <h3 className="font-bold text-lg">{currentTip.title}</h3>

        {/* Description */}
        <p className="text-muted-foreground">{currentTip.description}</p>

        {/* Example Box */}
        <div className="p-4 rounded-lg bg-muted/50 border-l-4 border-primary">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            💡 Exemplo prático:
          </div>
          <p className="text-sm italic">{currentTip.example}</p>
        </div>

        {/* Learn More */}
        {currentTip.learnMoreUrl && (
          <Button variant="link" className="p-0 h-auto" asChild>
            <a href={currentTip.learnMoreUrl} target="_blank" rel="noopener noreferrer">
              Saber mais <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </InsightCard>
  );
}
