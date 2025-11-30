import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  XCircle,
  Link as LinkIcon,
  BarChart3,
  FileUp,
  Package,
  Users,
  Building2,
  Activity,
  FileCheck,
  Tag,
  MapPin,
  FileText,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ENTITY_ICONS: Record<string, any> = {
  accounts: Building2,
  contacts: Users,
  opportunities: FileText,
  products: Package,
  activities: Activity,
  proposals: FileCheck,
  loss_reasons: X,
  origins: Tag,
  territories: MapPin,
};

const ENTITY_LABELS: Record<string, string> = {
  accounts: 'Empresas',
  contacts: 'Contatos',
  opportunities: 'Oportunidades',
  products: 'Produtos',
  activities: 'Atividades',
  proposals: 'Propostas',
  loss_reasons: 'Motivos de Perda',
  origins: 'Origens',
  territories: 'Territórios',
};

interface EntityStats {
  entity_type: string;
  total_imports: number;
  total_records: number;
  success_records: number;
  error_records: number;
  relationships_created: number;
  success_rate: number;
}

export default function ImportStatsCard() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['import-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .in('status', ['completed', 'failed', 'validation_failed']);

      if (error) throw error;

      // Aggregate stats by entity type
      const aggregated = data.reduce((acc: Record<string, EntityStats>, log) => {
        const entity = log.entity_type;
        
        if (!acc[entity]) {
          acc[entity] = {
            entity_type: entity,
            total_imports: 0,
            total_records: 0,
            success_records: 0,
            error_records: 0,
            relationships_created: 0,
            success_rate: 0,
          };
        }

        acc[entity].total_imports += 1;
        acc[entity].total_records += log.total_rows || 0;
        acc[entity].success_records += log.success_count || 0;
        acc[entity].error_records += log.error_count || 0;
        acc[entity].relationships_created += log.relationship_count || 0;

        return acc;
      }, {});

      // Calculate success rates
      Object.values(aggregated).forEach(stat => {
        if (stat.total_records > 0) {
          stat.success_rate = Math.round((stat.success_records / stat.total_records) * 100);
        }
      });

      return Object.values(aggregated).sort((a, b) => b.total_records - a.total_records);
    },
  });

  const totalImports = stats.reduce((sum, s) => sum + s.total_imports, 0);
  const totalRecords = stats.reduce((sum, s) => sum + s.total_records, 0);
  const totalSuccess = stats.reduce((sum, s) => sum + s.success_records, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.error_records, 0);
  const totalRelationships = stats.reduce((sum, s) => sum + s.relationships_created, 0);
  const overallSuccessRate = totalRecords > 0 ? Math.round((totalSuccess / totalRecords) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas de Migração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Estatísticas Gerais</CardTitle>
              <CardDescription className="mt-2">
                Resumo de todas as importações realizadas
              </CardDescription>
            </div>
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileUp className="h-4 w-4" />
                <span>Importações</span>
              </div>
              <div className="text-2xl font-bold">{totalImports}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <BarChart3 className="h-4 w-4" />
                <span>Total Registros</span>
              </div>
              <div className="text-2xl font-bold">{totalRecords.toLocaleString('pt-BR')}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Sucesso</span>
              </div>
              <div className="text-2xl font-bold text-success">{totalSuccess.toLocaleString('pt-BR')}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                <span>Erros</span>
              </div>
              <div className="text-2xl font-bold text-destructive">{totalErrors.toLocaleString('pt-BR')}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary text-sm">
                <LinkIcon className="h-4 w-4" />
                <span>Vínculos</span>
              </div>
              <div className="text-2xl font-bold text-primary">{totalRelationships.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          {/* Success Rate Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa de Sucesso Geral</span>
              <span className="font-medium flex items-center gap-1">
                {overallSuccessRate >= 80 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-warning" />
                )}
                {overallSuccessRate}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  overallSuccessRate >= 80 ? 'bg-success' : 
                  overallSuccessRate >= 60 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${overallSuccessRate}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per Entity Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Estatísticas por Entidade</CardTitle>
          <CardDescription>
            Detalhamento de importações por tipo de dado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma estatística disponível ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.map((stat) => {
                const EntityIcon = ENTITY_ICONS[stat.entity_type] || FileUp;
                const successRate = stat.success_rate;

                return (
                  <div key={stat.entity_type} className="border rounded-lg p-4 hover:bg-accent/5 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <EntityIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{ENTITY_LABELS[stat.entity_type] || stat.entity_type}</h4>
                          <p className="text-sm text-muted-foreground">
                            {stat.total_imports} importaç{stat.total_imports === 1 ? 'ão' : 'ões'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={successRate >= 80 ? 'default' : successRate >= 60 ? 'secondary' : 'destructive'}>
                        {successRate}% sucesso
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Total</div>
                        <div className="font-medium">{stat.total_records.toLocaleString('pt-BR')}</div>
                      </div>
                      <div>
                        <div className="text-success text-xs">Sucesso</div>
                        <div className="font-medium text-success">{stat.success_records.toLocaleString('pt-BR')}</div>
                      </div>
                      <div>
                        <div className="text-destructive text-xs">Erros</div>
                        <div className="font-medium text-destructive">{stat.error_records.toLocaleString('pt-BR')}</div>
                      </div>
                      <div>
                        <div className="text-primary text-xs">Vínculos</div>
                        <div className="font-medium text-primary">{stat.relationships_created.toLocaleString('pt-BR')}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            successRate >= 80 ? 'bg-success' : 
                            successRate >= 60 ? 'bg-warning' : 'bg-destructive'
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
