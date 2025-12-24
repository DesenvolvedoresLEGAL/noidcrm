import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  MessageSquare, 
  Shield, 
  Lightbulb,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useVibeNarratives, DEFAULT_NARRATIVES } from '@/hooks/useVibeNarratives';
import { useToast } from '@/hooks/use-toast';

interface VibeNarrativeCardProps {
  vibeState?: string;
  className?: string;
}

export function VibeNarrativeCard({ vibeState, className }: VibeNarrativeCardProps) {
  const { currentNarrative, isLoading } = useVibeNarratives(vibeState);
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [showObjections, setShowObjections] = useState(false);

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      toast({
        title: 'Copiado!',
        description: 'Texto copiado para a área de transferência',
      });
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o texto',
        variant: 'destructive'
      });
    }
  };

  if (!vibeState) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Narrativa Recomendada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Execute a análise emocional para receber recomendações de narrativa.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Narrativa Recomendada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const narrative = currentNarrative || DEFAULT_NARRATIVES.find(n => n.vibe_state === vibeState);

  if (!narrative) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Narrativa Recomendada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma narrativa encontrada para o estado: {vibeState}
          </p>
        </CardContent>
      </Card>
    );
  }

  const objectionEntries = narrative.objection_handlers 
    ? Object.entries(narrative.objection_handlers) 
    : [];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Narrativa Recomendada
          </CardTitle>
          <Badge variant="secondary" className="capitalize">
            {vibeState?.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-foreground">{narrative.title}</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Template da Narrativa */}
        <div className="bg-muted/50 rounded-lg p-3 border">
          <p className="text-sm leading-relaxed">{narrative.narrative_template}</p>
        </div>

        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Mensagens-chave
            </TabsTrigger>
            <TabsTrigger value="proofs" className="text-xs">
              <Lightbulb className="h-3 w-3 mr-1" />
              Provas Sociais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-3">
            <ScrollArea className="h-[140px]">
              <div className="space-y-2">
                {narrative.key_messages?.map((message, idx) => (
                  <div 
                    key={idx}
                    className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground mt-1">{idx + 1}.</span>
                    <p className="text-sm flex-1">{message}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(message, `msg-${idx}`)}
                    >
                      {copiedItem === `msg-${idx}` ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="proofs" className="mt-3">
            <ScrollArea className="h-[140px]">
              <div className="space-y-2">
                {narrative.proof_points?.map((proof, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm">{proof}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Objeções */}
        {objectionEntries.length > 0 && (
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
              onClick={() => setShowObjections(!showObjections)}
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Como lidar com objeções ({objectionEntries.length})
              </span>
              {showObjections ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showObjections && (
              <div className="mt-3 space-y-3">
                {objectionEntries.map(([objection, response], idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Objeção
                      </Badge>
                      <span className="text-sm font-medium text-destructive">
                        "{objection}"
                      </span>
                    </div>
                    <div className="group flex items-start gap-2 pl-2 border-l-2 border-primary/30">
                      <p className="text-sm flex-1 text-muted-foreground">
                        {response as string}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => copyToClipboard(response as string, `obj-${idx}`)}
                      >
                        {copiedItem === `obj-${idx}` ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
