import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ConversionFunnel } from "@/components/learning/ConversionFunnel";
import { SignalsPanel } from "@/components/learning/SignalsPanel";
import { OutreachPerformanceTable } from "@/components/learning/OutreachPerformanceTable";
import { Brain, TrendingUp, Send } from "lucide-react";

export default function LearningPerformancePage() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance & Aprendizado</h1>
          <p className="text-sm text-muted-foreground">
            Como o NOID Intelligence aprende com cada interação para melhorar score e decisões.
          </p>
        </div>
      </div>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">
            <TrendingUp className="h-4 w-4 mr-2" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="signals">
            <Brain className="h-4 w-4 mr-2" />
            Sinais
          </TabsTrigger>
          <TabsTrigger value="outreach">
            <Send className="h-4 w-4 mr-2" />
            Outreach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel">
          <ConversionFunnel organizationId={orgId} />
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Como ler</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Cada barra mostra o volume de eventos da etapa nos últimos 30 dias. A
                porcentagem ao lado indica a taxa de conversão entre etapas
                consecutivas.
              </p>
              <p>
                Eventos vêm de <code className="text-xs">revenue_events</code>, alimentados
                automaticamente por enriquecimento, decisões, envios, aberturas e
                fechamentos.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SignalsPanel organizationId={orgId} variant="top" />
            <SignalsPanel organizationId={orgId} variant="worst" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Como funciona o aprendizado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                A cada evento terminal (resposta, reunião, win, loss), o sistema
                associa os sinais do prospect àquele resultado e recalcula o
                impact_score, que ajusta o score futuro de leads similares.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Mínimo de 20 ocorrências antes de aplicar impacto (anti-viés)</li>
                <li>Impact_score limitado entre -20 e +20 (anti-overfitting)</li>
                <li>Apenas sinais com confiança ≥ 20% influenciam o score</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <OutreachPerformanceTable organizationId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
