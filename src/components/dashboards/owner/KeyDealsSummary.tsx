import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, AlertTriangle, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface KeyDealsSummaryProps {
  enterpriseDeals: { company: string; value: number; stage: string; owner: string }[];
  closingThisMonth: { company: string; value: number; probability: number; daysLeft: number }[];
  churnRisk: { account: string; lastContact: string; risk: number }[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

export function KeyDealsSummary({ enterpriseDeals, closingThisMonth, churnRisk }: KeyDealsSummaryProps) {
  const topEnterprise = enterpriseDeals.slice(0, 2);
  const topClosing = closingThisMonth.slice(0, 2);
  const topChurn = churnRisk.slice(0, 2);

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Deals Estratégicos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enterprise Deals */}
        {topEnterprise.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Enterprise ({enterpriseDeals.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {topEnterprise.map((deal, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/10"
                >
                  <span className="text-sm font-medium truncate max-w-[140px]">{deal.company}</span>
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                    {formatCurrency(deal.value)}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Closing This Month */}
        {topClosing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fechando Este Mês ({closingThisMonth.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {topClosing.map((deal, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.2 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate max-w-[100px]">{deal.company}</span>
                    <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    {deal.daysLeft}d
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Churn Risk */}
        {topChurn.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Risco de Churn ({churnRisk.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {topChurn.map((risk, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.4 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                >
                  <span className="text-sm font-medium truncate max-w-[140px]">{risk.account}</span>
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                    {risk.risk}% risco
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {topEnterprise.length === 0 && topClosing.length === 0 && topChurn.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhum deal estratégico no momento
          </div>
        )}
      </CardContent>
    </Card>
  );
}
