import { Layout } from '@/components/Layout';
import { GoalStrategy } from '@/components/insights/GoalStrategy';
import { RiskOpportunities } from '@/components/insights/RiskOpportunities';
import { PredictiveAnalysis } from '@/components/insights/PredictiveAnalysis';
import { PersonalPerformance } from '@/components/insights/PersonalPerformance';
import { SalesTipCard } from '@/components/insights/SalesTipCard';
import { EmotionalIntelligence } from '@/components/insights/EmotionalIntelligence';
import { PatternAnalysis } from '@/components/insights/PatternAnalysis';
import { TrainingRecommendations } from '@/components/insights/TrainingRecommendations';
import { Lightbulb } from 'lucide-react';

export default function Insights() {
  return (
    <Layout>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
            <Lightbulb className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Insights</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Inteligência artificial aplicada às suas vendas
            </p>
          </div>
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
