import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useGenerateBlueprint } from '@/hooks/useAIAgents';
import BlueprintPreview from './BlueprintPreview';
import type { AgentBlueprint } from '@/types/ai-agents';

const HELPER_CHIPS = [
  { label: 'Follow-up por email', text: 'follow-up automático por email' },
  { label: 'Qualificação de leads', text: 'qualificar leads novos automaticamente' },
  { label: 'Alerta de risco', text: 'alertar sobre oportunidades em risco' },
  { label: 'Prospecção outbound', text: 'prospecção outbound via email e WhatsApp' },
  { label: 'Forecast inteligente', text: 'analisar pipeline e gerar forecast' },
  { label: 'Engajamento pós-venda', text: 'engajamento pós-venda e retenção' },
];

export default function AICreationMode() {
  const [text, setText] = useState('');
  const [blueprint, setBlueprint] = useState<AgentBlueprint | null>(null);
  const generateMutation = useGenerateBlueprint();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    const result = await generateMutation.mutateAsync({ mode: 'conversation', text: text.trim() });
    setBlueprint(result);
  };

  const appendChip = (chipText: string) => {
    setText((prev) => {
      if (prev.trim()) return `${prev}, ${chipText}`;
      return `Quero um agente de ${chipText}`;
    });
  };

  if (blueprint) {
    return (
      <BlueprintPreview
        blueprint={blueprint}
        onBack={() => setBlueprint(null)}
        onRefine={() => {
          setBlueprint(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descreva o agente que você quer criar...&#10;&#10;Exemplo: Quero um agente de follow-up por email para oportunidades paradas após proposta visualizada, com autonomia assistida e escalonamento quando houver risco alto."
          rows={6}
          className="text-base resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {HELPER_CHIPS.map((chip) => (
            <Badge
              key={chip.label}
              variant="outline"
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => appendChip(chip.text)}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleGenerate}
          disabled={!text.trim() || generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando blueprint...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar Blueprint
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
