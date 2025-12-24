import { useState } from 'react';
import { useVibeNarratives, DEFAULT_NARRATIVES, VibeNarrative } from '@/hooks/useVibeNarratives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BookOpen, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  MessageSquare,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const VIBE_STATE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  curioso: { label: 'Curioso', color: 'bg-blue-500', emoji: '🔍' },
  exploratorio: { label: 'Exploratório', color: 'bg-cyan-500', emoji: '🧭' },
  cetico: { label: 'Cético', color: 'bg-amber-500', emoji: '🤔' },
  comparativo: { label: 'Comparativo', color: 'bg-purple-500', emoji: '⚖️' },
  em_decisao: { label: 'Em Decisão', color: 'bg-green-500', emoji: '✅' },
  travado: { label: 'Travado', color: 'bg-red-500', emoji: '🛑' },
  quente_silencioso: { label: 'Quente Silencioso', color: 'bg-orange-500', emoji: '🔥' },
  pronto_inseguro: { label: 'Pronto Inseguro', color: 'bg-teal-500', emoji: '🎯' }
};

type NarrativeDisplay = VibeNarrative | Omit<VibeNarrative, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;

function NarrativeCard({ narrative }: { narrative: NarrativeDisplay }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const config = VIBE_STATE_CONFIG[narrative.vibe_state] || { 
    label: narrative.vibe_state, 
    color: 'bg-gray-500', 
    emoji: '📌' 
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      isExpanded ? "ring-2 ring-primary/20" : "hover:shadow-md"
    )}>
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`text-2xl`}>{config.emoji}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${config.color} text-white`}>
                  {config.label}
                </Badge>
              </div>
              <CardTitle className="text-lg">{narrative.title}</CardTitle>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription className="mt-2">
          {narrative.narrative_template}
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-0">
          {/* Key Messages */}
          {narrative.key_messages && narrative.key_messages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-primary" />
                Mensagens-Chave
              </div>
              <div className="space-y-2">
                {narrative.key_messages.map((message, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
                  >
                    <p className="text-sm italic">"{message}"</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopy(message, `msg-${i}`)}
                    >
                      {copiedField === `msg-${i}` ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof Points */}
          {narrative.proof_points && narrative.proof_points.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Pontos de Prova
              </div>
              <div className="flex flex-wrap gap-2">
                {narrative.proof_points.map((point, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Objection Handlers */}
          {narrative.objection_handlers && Object.keys(narrative.objection_handlers).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-red-500" />
                Tratamento de Objeções
              </div>
              <div className="space-y-2">
                {Object.entries(narrative.objection_handlers).map(([objection, response], i) => (
                  <div 
                    key={i}
                    className="p-3 rounded-lg border bg-card group"
                  >
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                      "{objection}"
                    </p>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-muted-foreground">{response}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => handleCopy(response, `obj-${i}`)}
                      >
                        {copiedField === `obj-${i}` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function VibeNarrativesLibrary() {
  const { narratives, isLoading, initializeDefaultNarratives } = useVibeNarratives();

  // Use org narratives if available, otherwise use defaults
  const displayNarratives = narratives && narratives.length > 0 
    ? narratives 
    : DEFAULT_NARRATIVES;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Biblioteca de Narrativas
            </CardTitle>
          </CardHeader>
        </Card>
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Biblioteca de Narrativas
              </CardTitle>
              <CardDescription>
                Narrativas personalizadas para cada estado emocional do lead
              </CardDescription>
            </div>
            {(!narratives || narratives.length === 0) && (
              <Button 
                variant="outline"
                onClick={() => initializeDefaultNarratives.mutate()}
                disabled={initializeDefaultNarratives.isPending}
              >
                Salvar Narrativas Padrão
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {displayNarratives.map((narrative, index) => (
          <NarrativeCard 
            key={'id' in narrative ? (narrative as VibeNarrative).id : `default-${index}`} 
            narrative={narrative} 
          />
        ))}
      </div>
    </div>
  );
}
