import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, ShoppingBag, TrendingUp, AlertTriangle, Cpu } from 'lucide-react';
import { EnrichmentQualityBadge } from './EnrichmentQualityBadge';
import { FallbackIndicator } from './FallbackIndicator';

interface CompanyEnrichmentCardProps {
  profile: {
    company_summary?: string | null;
    business_model?: string | null;
    market_type?: string | null;
    company_size_estimate?: string | null;
    geographic_presence?: any;
    products_services?: any;
    growth_signals?: any;
    commercial_pains?: any;
    tech_signals?: any;
    confidence?: number | null;
  };
  run?: {
    quality_grade?: string | null;
    quality_score?: number | null;
    fallback_used?: boolean | null;
    fallback_pages_fetched?: any;
    content_length?: number | null;
    missing_fields?: any;
  } | null;
}

const FIELD_LABELS: Record<string, string> = {
  company_summary: 'resumo',
  business_model: 'modelo de negócio',
  market_type: 'tipo de mercado',
  industry: 'indústria',
  target_customer: 'cliente-alvo',
  geo: 'região',
  company_size_hint: 'porte',
  top_pains: 'dores',
  top_opportunities: 'oportunidades',
  trigger_signals: 'sinais',
  digital_maturity: 'maturidade digital',
};

function TagList({ items, icon: Icon, color }: { items: string[]; icon: any; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <Badge key={i} variant="outline" className={`gap-1 text-xs ${color}`}>
          <Icon className="h-3 w-3" />{item}
        </Badge>
      ))}
    </div>
  );
}

export function CompanyEnrichmentCard({ profile, run }: CompanyEnrichmentCardProps) {
  const grade = (run?.quality_grade as 'A' | 'B' | 'C' | 'D' | undefined) ?? null;
  const score = run?.quality_score ?? (profile.confidence != null ? Math.round((profile.confidence as number) * 100) : null);
  const fallbackPages = Array.isArray(run?.fallback_pages_fetched) ? (run!.fallback_pages_fetched as any[]) : [];
  const fallbackUsed = !!run?.fallback_used;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Building2 className="h-4 w-4 text-primary" />
          Perfil da Empresa
          <div className="ml-auto">
            {grade ? (
              <EnrichmentQualityBadge grade={grade} score={score} />
            ) : score != null ? (
              <Badge variant="secondary" className="text-xs">{score}% confiança</Badge>
            ) : null}
          </div>
        </CardTitle>
        {fallbackUsed && (
          <div className="pt-1">
            <FallbackIndicator pages={fallbackPages} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {profile.company_summary && <p className="text-muted-foreground">{profile.company_summary}</p>}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {profile.business_model && (
            <div><span className="text-muted-foreground">Modelo:</span> <span className="font-medium">{profile.business_model}</span></div>
          )}
          {profile.market_type && (
            <div><span className="text-muted-foreground">Mercado:</span> <span className="font-medium">{profile.market_type}</span></div>
          )}
          {profile.company_size_estimate && (
            <div><span className="text-muted-foreground">Porte:</span> <span className="font-medium">{profile.company_size_estimate}</span></div>
          )}
          {run?.content_length != null && (
            <div><span className="text-muted-foreground">Conteúdo:</span> <span className="font-medium">{run.content_length.toLocaleString('pt-BR')} chars</span></div>
          )}
        </div>

        {profile.geographic_presence?.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />Presença geográfica</span>
            <div className="flex flex-wrap gap-1">{(profile.geographic_presence as string[]).map((g, i) => <Badge key={i} variant="secondary" className="text-xs">{g}</Badge>)}</div>
          </div>
        )}

        <TagList items={profile.products_services as string[] || []} icon={ShoppingBag} color="border-blue-500/30 text-blue-600" />
        <TagList items={profile.growth_signals as string[] || []} icon={TrendingUp} color="border-green-500/30 text-green-600" />
        <TagList items={profile.tech_signals as string[] || []} icon={Cpu} color="border-purple-500/30 text-purple-600" />
        <TagList items={profile.commercial_pains as string[] || []} icon={AlertTriangle} color="border-amber-500/30 text-amber-600" />
      </CardContent>
    </Card>
  );
}
