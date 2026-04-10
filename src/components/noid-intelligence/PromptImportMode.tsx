import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Loader2 } from 'lucide-react';
import { useGenerateBlueprint } from '@/hooks/useAIAgents';
import BlueprintPreview from './BlueprintPreview';
import type { AgentBlueprint } from '@/types/ai-agents';

const ORIGINS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'manus', label: 'Manus' },
  { value: 'other', label: 'Outro' },
];

export default function PromptImportMode() {
  const [text, setText] = useState('');
  const [origin, setOrigin] = useState('');
  const [blueprint, setBlueprint] = useState<AgentBlueprint | null>(null);
  const generateMutation = useGenerateBlueprint();

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    const input = origin ? `[Origem: ${origin}]\n\n${text.trim()}` : text.trim();
    const result = await generateMutation.mutateAsync({ mode: 'prompt_import', text: input });
    setBlueprint(result);
  };

  if (blueprint) {
    return (
      <BlueprintPreview
        blueprint={blueprint}
        onBack={() => setBlueprint(null)}
        onRefine={() => setBlueprint(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Origem do prompt (opcional)</Label>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {ORIGINS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o prompt completo do agente..."
            rows={10}
            className="text-sm font-mono resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleAnalyze}
          disabled={!text.trim() || generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando prompt...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Analisar Prompt
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
