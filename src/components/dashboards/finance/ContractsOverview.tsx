import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractsOverviewProps {
  data: {
    activeContracts: number;
    totalContractValue: number;
    dueIn30Days: number;
    recentContracts: Array<{
      id: string;
      title: string;
      accountName: string;
      value: number;
      endDate: string | null;
      status: string;
    }>;
  };
}

export function ContractsOverview({ data }: ContractsOverviewProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Ativo</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "expired":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileCheck className="h-4 w-4 text-blue-500" />
            Contratos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg font-bold text-blue-600">{data.activeContracts}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-emerald-600">
                R$ {(data.totalContractValue / 1000).toFixed(0)}k
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <p className="text-xs text-muted-foreground">Vence em 30d</p>
              </div>
              <p className="text-lg font-bold text-amber-600">{data.dueIn30Days}</p>
            </div>
          </div>

          {/* Recent Contracts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Contratos Recentes
            </p>
            {data.recentContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum contrato cadastrado
              </p>
            ) : (
              <div className="space-y-2">
                {data.recentContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{contract.title}</p>
                      <p className="text-xs text-muted-foreground">{contract.accountName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <p className="text-sm font-bold">
                          R$ {contract.value.toLocaleString("pt-BR")}
                        </p>
                        {contract.endDate && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(contract.endDate), "dd/MM/yy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(contract.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
