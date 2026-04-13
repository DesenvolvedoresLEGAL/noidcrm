import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Users, Target, Zap, BarChart3 } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
}

interface Rec {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

function generateRecommendations(data: WinLossDataResult | undefined) {
  if (!data) return { sales: [] as Rec[], marketing: [] as Rec[], product: [] as Rec[], revops: [] as Rec[] };

  const sales: Rec[] = [];
  const marketing: Rec[] = [];
  const product: Rec[] = [];
  const revops: Rec[] = [];

  if (data.lossReasons.length > 0) {
    const top = data.lossReasons[0];
    sales.push({ title: `Treinar objeção: ${top.reason}`, description: `${top.count} perdas — criar playbook`, priority: 'high' });
  }
  if (data.competitors.length > 0) {
    const top = data.competitors[0];
    sales.push({ title: `Battle card: ${top.competitor}`, description: `Perdemos ${top.count} deals — mapear diferenciais`, priority: 'high' });
  }
  if (data.winReasons.length > 0) {
    const top = data.winReasons[0];
    sales.push({ title: `Reforçar argumento: ${top.reason}`, description: `${top.count} deals ganhos com este fator`, priority: 'medium' });
  }

  if (data.differentiators.length > 0) {
    marketing.push({ title: `Destacar: ${data.differentiators[0].differentiator}`, description: `Diferencial mais mencionado (${data.differentiators[0].count}x)`, priority: 'high' });
  }
  if (data.factors.price > 0 && data.lostCount > 0) {
    const pct = Math.round((data.factors.price / data.lostCount) * 100);
    if (pct > 30) marketing.push({ title: 'Comunicar valor antes do preço', description: `${pct}% das perdas citam preço`, priority: 'high' });
  }

  if (data.factors.feature > 0) product.push({ title: 'Features críticas para roadmap', description: `${data.factors.feature} perdas por falta de funcionalidades`, priority: 'high' });
  if (data.differentiators.length > 0) product.push({ title: 'Manter diferenciais competitivos', description: `Proteger: ${data.differentiators.slice(0, 2).map(d => d.differentiator).join(', ')}`, priority: 'medium' });

  if (data.avgCycleWon && data.avgCycleLost && data.avgCycleLost > data.avgCycleWon * 1.5) {
    revops.push({ title: 'Reduzir ciclo de vendas perdidas', description: `Perdas: ${data.avgCycleLost}d vs Ganhos: ${data.avgCycleWon}d`, priority: 'high' });
  }
  if (data.winRate < 30) revops.push({ title: 'Melhorar qualificação', description: `Win rate de ${data.winRate}% — revisar ICP`, priority: 'high' });

  // Seller-based recs
  const lowPerformers = data.sellerStats.filter(s => (s.won + s.lost) >= 3 && s.winRate < 25);
  if (lowPerformers.length > 0) {
    revops.push({ title: `Coaching: ${lowPerformers.map(s => s.name.split(' ')[0]).join(', ')}`, description: `${lowPerformers.length} vendedor(es) com win rate < 25%`, priority: 'high' });
  }

  return { sales, marketing, product, revops };
}

export function WinLossRecommendationsTab({ data }: Props) {
  const recs = generateRecommendations(data);

  if (!data || (data.wonCount === 0 && data.lostCount === 0)) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Recomendações Inteligentes</h3>
          <p className="text-sm text-muted-foreground">Registre mais resultados para obter insights personalizados.</p>
        </CardContent>
      </Card>
    );
  }

  const sections = [
    { key: 'sales', title: 'Para Vendas', icon: Users, color: 'text-blue-500', items: recs.sales },
    { key: 'marketing', title: 'Para Marketing', icon: Target, color: 'text-purple-500', items: recs.marketing },
    { key: 'product', title: 'Para Produto', icon: Zap, color: 'text-yellow-500', items: recs.product },
    { key: 'revops', title: 'Para RevOps', icon: BarChart3, color: 'text-emerald-500', items: recs.revops },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {sections.map(section => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <section.icon className={`h-4 w-4 ${section.color}`} />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.items.length > 0 ? section.items.map((rec, i) => (
              <div key={i} className={`p-2.5 rounded-lg border ${rec.priority === 'high' ? 'border-red-500/30 bg-red-500/5' : rec.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-muted'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-xs">{rec.title}</p>
                  <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">
                    {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">Mais dados necessários</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
