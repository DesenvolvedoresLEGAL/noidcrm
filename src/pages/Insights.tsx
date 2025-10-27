import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, Construction } from 'lucide-react';

export default function Insights() {
  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">
            Insights de IA
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Análises inteligentes e recomendações personalizadas
          </p>
        </div>

        {/* Em desenvolvimento */}
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-6">
              <Construction className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Módulo em Desenvolvimento</h2>
            </div>
            <p className="text-muted-foreground max-w-md mb-6">
              O módulo de Insights está sendo desenvolvido e estará disponível em breve com análises preditivas, recomendações de IA e estratégias personalizadas.
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              <div className="px-4 py-2 rounded-full bg-primary/10 text-primary">
                Análise Preditiva
              </div>
              <div className="px-4 py-2 rounded-full bg-accent/10 text-accent">
                Inteligência Emocional
              </div>
              <div className="px-4 py-2 rounded-full bg-secondary/10 text-secondary">
                Identificação de Padrões
              </div>
              <div className="px-4 py-2 rounded-full bg-primary/10 text-primary">
                Recomendações de Treinamento
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
