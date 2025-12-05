import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Zap, AlertTriangle, Activity } from "lucide-react";

// Placeholder for Sprint 4 implementation
export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Operações</h1>
        <p className="text-muted-foreground">
          Governança, qualidade dos dados e automações
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Database className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saúde da Base</p>
                <p className="text-2xl font-bold">92%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Automações</p>
                <p className="text-2xl font-bold">24 ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Activity className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">VOLTS Usados</p>
                <p className="text-2xl font-bold">1.2k</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Sprint 4</Badge>
            Dashboard Completo de Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este dashboard será implementado no Sprint 4 com:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Data Quality Score detalhado</li>
            <li>Monitor de integrações (APIs, WhatsApp, E-mail)</li>
            <li>Fluxo de automação por etapa</li>
            <li>Consumo de VOLTS por operação</li>
            <li>Detecção de duplicidades pela IA</li>
            <li>Logs detalhados do sistema</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
