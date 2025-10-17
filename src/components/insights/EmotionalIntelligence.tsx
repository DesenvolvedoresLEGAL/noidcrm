import { useEffect, useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getEmotionalIntelligenceTips, EITip } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function EmotionalIntelligence() {
  const [tips, setTips] = useState<EITip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmotionalIntelligenceTips().then(result => {
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

  const getPillarLabel = (pillar: string) => {
    const labels: Record<string, string> = {
      'self-awareness': 'Autoconhecimento',
      'self-management': 'Autogestão',
      empathy: 'Empatia',
      relationship: 'Relacionamento'
    };
    return labels[pillar] || pillar;
  };

  const getPillarColor = (pillar: string) => {
    const colors: Record<string, string> = {
      'self-awareness': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'self-management': 'bg-green-500/10 text-green-500 border-green-500/20',
      empathy: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      relationship: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    };
    return colors[pillar] || 'bg-muted text-muted-foreground';
  };

  return (
    <InsightCard
      title="Inteligência Emocional"
      description="Desenvolva suas habilidades emocionais"
      icon={Heart}
      iconColor="text-pink-500"
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
            Dia {currentTip.dayNumber} / 30
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
        {/* Pillar Badge */}
        <Badge className={getPillarColor(currentTip.pillar)}>
          {getPillarLabel(currentTip.pillar)}
        </Badge>

        {/* Title */}
        <h3 className="font-bold text-lg">{currentTip.title}</h3>

        {/* Content */}
        <p className="text-muted-foreground">{currentTip.content}</p>

        {/* Actionable Box */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-pink-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-pink-500 mb-1">
                Exercício de hoje:
              </div>
              <p className="text-sm">{currentTip.actionable}</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Continue praticando diariamente</span>
          <span className="font-medium">{Math.round((currentTip.dayNumber / 30) * 100)}% completo</span>
        </div>
      </div>
    </InsightCard>
  );
}
