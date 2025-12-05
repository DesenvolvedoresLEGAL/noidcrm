import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Sparkles } from "lucide-react";

// Placeholder for Sprint 5 implementation
export function OwnerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cockpit Executivo</h1>
        <p className="text-muted-foreground">
          Visão estratégica, receita e previsibilidade
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR Projetado</p>
                <p className="text-2xl font-bold">R$ 85k</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Run Rate Anual</p>
                <p className="text-2xl font-bold">R$ 1.02M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">R$ 4.2k</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/10">
                <Sparkles className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LTV</p>
                <p className="text-2xl font-bold">R$ 18k</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Sprint 5</Badge>
            Dashboard Completo do CEO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este dashboard será implementado no Sprint 5 com:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Previsão trimestral IA (cenários pessimista/realista/otimista)</li>
            <li>CAC e Payback por unidade de negócio</li>
            <li>Margem por produto (SPEEDY, ALUGUE, AI)</li>
            <li>ROI do time comercial e campanhas de marketing</li>
            <li>Mapa de calor do CRM (gargalos e aceleradores)</li>
            <li>Insights críticos gerados pelo HUMANOID</li>
            <li>Relatório MASTERMIND diário automático</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
