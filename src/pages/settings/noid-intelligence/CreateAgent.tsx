import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Settings, ArrowLeft } from 'lucide-react';
import AICreationMode from '@/components/noid-intelligence/AICreationMode';
import PromptImportMode from '@/components/noid-intelligence/PromptImportMode';
import ManualCreationMode from '@/components/noid-intelligence/ManualCreationMode';

type CreationMode = null | 'ai' | 'import' | 'manual';

const MODE_CARDS = [
  {
    id: 'ai' as const,
    icon: Sparkles,
    title: 'Criar com IA',
    description: 'Descreva o agente em linguagem natural e o NOID Architect monta a arquitetura completa.',
    accent: 'text-amber-500',
    bgAccent: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'import' as const,
    icon: FileText,
    title: 'Importar Prompt',
    description: 'Cole um prompt pronto do ChatGPT, Claude, Gemini ou outra ferramenta.',
    accent: 'text-blue-500',
    bgAccent: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'manual' as const,
    icon: Settings,
    title: 'Configurar Manualmente',
    description: 'Monte o agente campo a campo com controle total.',
    accent: 'text-muted-foreground',
    bgAccent: 'bg-muted/50 border-border',
  },
];

export default function CreateAgent() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreationMode>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {mode && (
          <Button variant="ghost" size="icon" onClick={() => setMode(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode ? MODE_CARDS.find(c => c.id === mode)?.title : 'Criar Novo Agente'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode
              ? 'Configure e revise antes de salvar'
              : 'Como você quer criar este agente?'}
          </p>
        </div>
      </div>

      {/* Mode Selection */}
      {!mode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODE_CARDS.map((card) => (
            <Card
              key={card.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${card.bgAccent}`}
              onClick={() => setMode(card.id)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className={`p-3 rounded-xl ${card.bgAccent}`}>
                  <card.icon className={`h-8 w-8 ${card.accent}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{card.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mode Content */}
      {mode === 'ai' && <AICreationMode />}
      {mode === 'import' && <PromptImportMode />}
      {mode === 'manual' && <ManualCreationMode />}

      {/* Cancel */}
      {!mode && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}
