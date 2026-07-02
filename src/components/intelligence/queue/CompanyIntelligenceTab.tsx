import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyGradeBadge } from './CompanyGradeBadge';
import { computeCompanyIntelligence, type CompanyGrade } from '@/services/intelligence/qualifiedQueue';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  prospectId: string;
}

export function CompanyIntelligenceTab({ prospectId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['kairos-company-intelligence', prospectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kairos_company_intelligence' as any)
        .select('*')
        .eq('prospect_id', prospectId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const recompute = useMutation({
    mutationFn: () => computeCompanyIntelligence(prospectId, true),
    onSuccess: () => {
      toast({ title: 'Company Intelligence recalculado' });
      qc.invalidateQueries({ queryKey: ['kairos-company-intelligence', prospectId] });
      qc.invalidateQueries({ queryKey: ['kairos-qualified-queue'] });
    },
    onError: (e: any) => toast({ title: 'Falha ao calcular', description: e?.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  if (!data) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Ainda não há análise de Company Intelligence para esta empresa.
        </p>
        <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          <Sparkles className="h-4 w-4 mr-2" />
          {recompute.isPending ? 'Calculando…' : 'Calcular agora'}
        </Button>
      </div>
    );
  }

  const buying = (data.buying_signals ?? []) as any[];
  const risks = (data.risk_signals ?? []) as any[];
  const hypotheses = (data.opportunity_hypotheses ?? []) as any[];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <CompanyGradeBadge grade={data.company_grade as CompanyGrade} score={data.company_intelligence_score} />
        <Button size="sm" variant="ghost" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          <RefreshCw className={`h-3 w-3 mr-2 ${recompute.isPending ? 'animate-spin' : ''}`} />
          Recalcular
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">ICP Fit</span><div className="font-semibold">{data.fit_score}/20</div></div>
        <div><span className="text-muted-foreground">Segmento</span><div className="font-semibold">{data.market_score}/10</div></div>
        <div><span className="text-muted-foreground">Porte</span><div className="font-semibold">{data.size_score}/10</div></div>
        <div><span className="text-muted-foreground">Digital</span><div className="font-semibold">{data.digital_presence_score}/10</div></div>
        <div><span className="text-muted-foreground">Evento</span><div className="font-semibold">{data.event_relevance_score}/10</div></div>
        <div><span className="text-muted-foreground">Relacionamento</span><div className="font-semibold">{data.relationship_score}/10</div></div>
        <div><span className="text-muted-foreground">Cobertura</span><div className="font-semibold">{data.coverage_score}/10</div></div>
        <div><span className="text-muted-foreground">Buying signals</span><div className="font-semibold">{data.buying_signal_score}/15</div></div>
        <div><span className="text-muted-foreground">Receita potencial</span><div className="font-semibold">{data.revenue_potential_score}/5</div></div>
        <div><span className="text-muted-foreground">Confiança</span><div className="font-semibold">{data.confidence_score}%</div></div>
      </section>

      {data.recommended_strategy && (
        <section>
          <div className="font-semibold mb-1">Estratégia recomendada</div>
          <p className="text-muted-foreground">{data.recommended_strategy}</p>
        </section>
      )}
      {data.next_best_action && (
        <section className="flex items-center gap-2">
          <span className="font-semibold">Próxima ação:</span>
          <Badge variant="outline">{data.next_best_action}</Badge>
          {data.apollo_recommended && <Badge className="bg-violet-600 text-white">Apollo recomendado</Badge>}
          {data.sdr_recommended && <Badge className="bg-emerald-600 text-white">SDR recomendado</Badge>}
          {data.human_review_required && <Badge variant="destructive">Revisão humana</Badge>}
        </section>
      )}

      {buying.length > 0 && (
        <section>
          <div className="font-semibold mb-1">Buying signals</div>
          <ul className="space-y-1 text-muted-foreground">
            {buying.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 text-emerald-600" />
                <span><strong>{s.signal}</strong>{s.evidence ? ` — ${s.evidence}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {risks.length > 0 && (
        <section>
          <div className="font-semibold mb-1">Riscos</div>
          <ul className="space-y-1 text-muted-foreground">
            {risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
                <span><strong>{r.risk}</strong>{r.evidence ? ` — ${r.evidence}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hypotheses.length > 0 && (
        <section>
          <div className="font-semibold mb-1">Hipóteses comerciais</div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            {hypotheses.map((h, i) => (
              <li key={i}>
                <strong>{h.hypothesis}</strong>
                {h.commercial_angle ? ` — ${h.commercial_angle}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {Array.isArray(data.missing_fields) && data.missing_fields.length > 0 && (
        <section className="border-t pt-3 text-xs text-muted-foreground">
          <span className="font-medium">Campos ausentes:</span>{' '}
          {data.missing_fields.join(', ')}
        </section>
      )}
    </div>
  );
}
