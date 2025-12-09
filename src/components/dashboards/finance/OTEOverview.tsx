import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Users, TrendingUp } from "lucide-react";

interface OTEOverviewProps {
  data: {
    totalCalculated: number;
    totalPending: number;
    totalPaid: number;
    topEarners: Array<{
      name: string;
      amount: number;
      achievement: number;
    }>;
  };
}

export function OTEOverview({ data }: OTEOverviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Coins className="h-4 w-4 text-amber-500" />
            Comissões (OTE)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-muted-foreground">Calculado</p>
              <p className="text-lg font-bold text-emerald-600">
                R$ {data.totalCalculated.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold text-amber-600">
                R$ {data.totalPending.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="text-lg font-bold text-blue-600">
                R$ {data.totalPaid.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Top Earners */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top Comissões do Mês
            </p>
            {data.topEarners.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma comissão calculada este mês
              </p>
            ) : (
              <div className="space-y-2">
                {data.topEarners.map((earner, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium">{earner.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {earner.achievement.toFixed(0)}%
                      </Badge>
                      <span className="text-sm font-bold">
                        R$ {earner.amount.toLocaleString("pt-BR")}
                      </span>
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
