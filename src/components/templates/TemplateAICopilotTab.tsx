import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Scale, MessageSquare, Loader2, CheckCircle2, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TemplateAICopilotTabProps {
  templateData: any;
  onApplyIntroduction: (value: string) => void;
  onApplyTerms: (value: string) => void;
  onApplyObservations: (value: string) => void;
}

const SEGMENTS = [
  'Tecnologia',
  'Saúde',
  'Educação',
  'Varejo',
  'Indústria',
  'Serviços',
  'Financeiro',
  'Construção',
  'Agronegócio',
  'Logística',
];

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'cordial', label: 'Cordial' },
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'tecnico', label: 'Técnico' },
];

export function TemplateAICopilotTab({
  templateData,
  onApplyIntroduction,
  onApplyTerms,
  onApplyObservations,
}: TemplateAICopilotTabProps) {
  const [segment, setSegment] = useState('');
  const [tone, setTone] = useState('formal');
  const [productContext, setProductContext] = useState('');
  
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingTerms, setGeneratingTerms] = useState(false);
  const [generatingObs, setGeneratingObs] = useState(false);
  
  const [generatedIntro, setGeneratedIntro] = useState('');
  const [generatedTerms, setGeneratedTerms] = useState('');
  const [generatedObs, setGeneratedObs] = useState('');

  const generateContent = async (type: 'introduction' | 'terms' | 'observations') => {
    const setLoading = {
      introduction: setGeneratingIntro,
      terms: setGeneratingTerms,
      observations: setGeneratingObs,
    }[type];
    
    const setGenerated = {
      introduction: setGeneratedIntro,
      terms: setGeneratedTerms,
      observations: setGeneratedObs,
    }[type];

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-template-content', {
        body: {
          type,
          segment,
          tone,
          productContext,
          templateName: templateData.name,
        },
      });

      if (error) throw error;

      setGenerated(data.content);
      toast.success('Conteúdo gerado com sucesso!');
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast.error('Erro ao gerar conteúdo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyGenerated = (type: 'introduction' | 'terms' | 'observations') => {
    const content = {
      introduction: generatedIntro,
      terms: generatedTerms,
      observations: generatedObs,
    }[type];
    
    const apply = {
      introduction: onApplyIntroduction,
      terms: onApplyTerms,
      observations: onApplyObservations,
    }[type];

    apply(content);
    toast.success('Conteúdo aplicado ao template!');
  };

  return (
    <div className="space-y-6">
      {/* Context Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Contexto para IA</CardTitle>
              <CardDescription>Configure o contexto para gerar textos mais precisos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Segmento do Cliente</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tom da Comunicação</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contexto do Produto/Serviço</Label>
            <Textarea
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              placeholder="Descreva brevemente o tipo de produto ou serviço que este template será usado para vender..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generate Introduction */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle className="text-base">Gerar Introdução</CardTitle>
                <CardDescription>Crie uma introdução profissional para suas propostas</CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => generateContent('introduction')} 
              disabled={generatingIntro}
              size="sm"
            >
              {generatingIntro ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Gerar
            </Button>
          </div>
        </CardHeader>
        {generatedIntro && (
          <CardContent className="space-y-3">
            <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
              {generatedIntro}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGeneratedIntro('')}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => applyGenerated('introduction')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Generate Terms */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-base">Gerar Termos e Condições</CardTitle>
                <CardDescription>Crie termos e condições padrão do mercado</CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => generateContent('terms')} 
              disabled={generatingTerms}
              size="sm"
            >
              {generatingTerms ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Gerar
            </Button>
          </div>
        </CardHeader>
        {generatedTerms && (
          <CardContent className="space-y-3">
            <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {generatedTerms}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGeneratedTerms('')}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => applyGenerated('terms')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Generate Observations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-base">Gerar Observações</CardTitle>
                <CardDescription>Crie notas e dicas relevantes para o cliente</CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => generateContent('observations')} 
              disabled={generatingObs}
              size="sm"
            >
              {generatingObs ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Gerar
            </Button>
          </div>
        </CardHeader>
        {generatedObs && (
          <CardContent className="space-y-3">
            <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
              {generatedObs}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGeneratedObs('')}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => applyGenerated('observations')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-sm">Dicas para melhores resultados:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Selecione o segmento correto para textos mais específicos</li>
                <li>Descreva bem o contexto do produto/serviço</li>
                <li>Use variáveis como {'{{contato_nome}}'} para personalização</li>
                <li>Revise e ajuste o texto gerado conforme necessário</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
