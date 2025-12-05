import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Settings, Users, AlertCircle, ExternalLink } from "lucide-react";
import { AdminDashboardData } from "@/hooks/useAdminDashboard";
import { useNavigate } from "react-router-dom";

interface AdminSmartListsProps {
  data: AdminDashboardData;
}

export function AdminSmartLists({ data }: AdminSmartListsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Registros Incompletos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-yellow-500" />
            Registros Incompletos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.incompleteRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os registros estão completos!</p>
          ) : (
            data.incompleteRecords.slice(0, 5).map((record, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{record.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.entity} • Falta: {record.missingFields.join(', ')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(`/app/accounts/${record.id}/edit`)}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
          {data.incompleteRecords.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{data.incompleteRecords.length - 5} registros
            </p>
          )}
        </CardContent>
      </Card>

      {/* Automações que Precisam Revisão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-orange-500" />
            Automações para Revisar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.automationsNeedingReview.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todas as automações estão OK!</p>
          ) : (
            data.automationsNeedingReview.map((auto, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{auto.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Última exec: {auto.lastRun === 'Nunca' ? 'Nunca' : new Date(auto.lastRun).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge variant={auto.status === 'Inativa' ? 'secondary' : 'destructive'} className="text-xs">
                  {auto.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Registros Duplicados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            Registros Duplicados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.duplicateRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma duplicidade detectada!</p>
          ) : (
            data.duplicateRecords.map((dup, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate capitalize">{dup.name}</p>
                  <p className="text-xs text-muted-foreground">{dup.entity}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {dup.count}x
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Campos Obrigatórios Faltando */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Campos Obrigatórios Faltando
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.missingRequiredFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os campos obrigatórios preenchidos!</p>
          ) : (
            data.missingRequiredFields.map((field, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{field.field}</p>
                  <p className="text-xs text-muted-foreground">{field.entity}</p>
                </div>
                <Badge variant="destructive" className="text-xs">
                  {field.count} registros
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
