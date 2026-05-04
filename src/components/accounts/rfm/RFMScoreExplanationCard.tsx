import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Layers } from 'lucide-react';

export function RFMScoreExplanationCard() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            RFM não mede intenção. Mede comportamento.
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Enquanto o Opportunity Score olha para negociações abertas, o RFM revela o histórico real
          da conta. Quem comprou, quanto comprou, quantas vezes comprou e há quanto tempo não compra.
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Como o RFM conversa com os outros scores
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-1">
          <div><span className="font-medium text-foreground">Lead Score</span> — conta antes da venda</div>
          <div><span className="font-medium text-foreground">Opportunity Score</span> — negociação aberta</div>
          <div><span className="font-medium text-foreground">NRHS</span> — qualidade do dado comercial</div>
          <div><span className="font-medium text-foreground">RFM</span> — comportamento histórico de compra</div>
          <div><span className="font-medium text-foreground">Account Score</span> — visão consolidada da conta</div>
        </CardContent>
      </Card>
    </div>
  );
}
