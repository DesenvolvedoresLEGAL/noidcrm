import { Layout } from '@/components/Layout';
import { GoalStrategy } from '@/components/insights/GoalStrategy';
import { RiskOpportunities } from '@/components/insights/RiskOpportunities';
import { PredictiveAnalysis } from '@/components/insights/PredictiveAnalysis';
import { PersonalPerformance } from '@/components/insights/PersonalPerformance';
import { SalesTipCard } from '@/components/insights/SalesTipCard';
import { EmotionalIntelligence } from '@/components/insights/EmotionalIntelligence';
import { PatternAnalysis } from '@/components/insights/PatternAnalysis';
import { TrainingRecommendations } from '@/components/insights/TrainingRecommendations';
import { Lightbulb, Target, TrendingUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Insights() {
  const statCards = [
    {
      title: 'Insights Gerados',
      value: '8',
      icon: Lightbulb,
      color: 'text-primary',
      description: 'Análises ativas',
    },
    {
      title: 'Oportunidades em Risco',
      value: '3',
      icon: Target,
      color: 'text-destructive',
      description: 'Requer atenção',
    },
    {
      title: 'Taxa de Conversão Prevista',
      value: '67.5%',
      icon: TrendingUp,
      color: 'text-accent',
      description: 'Próximo mês',
    },
    {
      title: 'Recomendações Ativas',
      value: '12',
      icon: Sparkles,
      color: 'text-secondary',
      description: 'Ações sugeridas',
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Insights</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Inteligência artificial aplicada às suas vendas
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Priority High */}
          <div className="space-y-6">
            <div style={{ animationDelay: '0ms' }}>
              <GoalStrategy />
            </div>
            <div style={{ animationDelay: '100ms' }}>
              <PredictiveAnalysis />
            </div>
            <div style={{ animationDelay: '200ms' }}>
              <SalesTipCard />
            </div>
            <div style={{ animationDelay: '300ms' }}>
              <PatternAnalysis />
            </div>
          </div>

          {/* Right Column - Priority Medium/Low */}
          <div className="space-y-6">
            <div style={{ animationDelay: '100ms' }}>
              <RiskOpportunities />
            </div>
            <div style={{ animationDelay: '200ms' }}>
              <PersonalPerformance />
            </div>
            <div style={{ animationDelay: '300ms' }}>
              <EmotionalIntelligence />
            </div>
            <div style={{ animationDelay: '400ms' }}>
              <TrainingRecommendations />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
