import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { Check, X, ArrowRight, AlertTriangle, Globe, MapPin, Building2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Prospect } from '@/hooks/useLeadSourcingV2';

interface ProspectDetailDrawerProps {
  prospect: Prospect | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCreateOpportunity: (id: string) => void;
  isUpdating: boolean;
  matchedAccountName?: string | null;
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DedupeBadge({ status }: { status: string }) {
  switch (status) {
    case 'strong_match':
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Duplicado forte</Badge>;
    case 'possible_match':
      return <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 bg-amber-500/10"><AlertTriangle className="h-3 w-3" />Possível duplicado</Badge>;
    case 'no_match':
      return <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600 bg-green-500/10"><Check className="h-3 w-3" />Sem duplicidade</Badge>;
    default:
      return <Badge variant="secondary">Não verificado</Badge>;
  }
}

export function ProspectDetailDrawer({
  prospect,
  open,
  onClose,
  onApprove,
  onReject,
  onCreateOpportunity,
  isUpdating,
  matchedAccountName,
}: ProspectDetailDrawerProps) {
  if (!prospect) return null;

  const score = prospect.prospect_scores?.[0];
  const reasoning = score?.reasoning as any;
  const signals: string[] = reasoning?.signals || [];
  const totalScore = score
    ? (score.icp_fit_score || 0) + (score.signal_score || 0) + (score.data_quality_score || 0) + (score.source_trust_score || 0) - (score.penalty_score || 0)
    : 0;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{prospect.company_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Resumo */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {prospect.normalized_domain && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{prospect.normalized_domain}</span>
                </div>
              )}
              {prospect.city && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{prospect.city}{prospect.state ? `, ${prospect.state}` : ''}</span>
                </div>
              )}
              {prospect.industry && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{prospect.industry}</span>
                </div>
              )}
            </div>
            {prospect.summary && (
              <p className="text-sm text-muted-foreground">{prospect.summary}</p>
            )}
          </section>

          <Separator />

          {/* Score Breakdown */}
          {score && (
            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h4>
              <div className="space-y-2.5">
                <ScoreBar label="ICP Fit" value={score.icp_fit_score || 0} />
                <ScoreBar label="Sinais" value={score.signal_score || 0} />
                <ScoreBar label="Qualidade de Dados" value={score.data_quality_score || 0} />
                <ScoreBar label="Confiança da Fonte" value={score.source_trust_score || 0} />
                {(score.penalty_score || 0) > 0 && (
                  <ScoreBar label="Penalidade" value={score.penalty_score || 0} />
                )}
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-medium">Score Total</span>
                <span className="text-lg font-bold">{totalScore}</span>
              </div>
              {score.grade && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Grade:</span>
                  <Badge variant="outline" className={cn('font-bold', {
                    'bg-green-500/10 text-green-600 border-green-500/20': score.grade === 'A',
                    'bg-blue-500/10 text-blue-600 border-blue-500/20': score.grade === 'B',
                    'bg-amber-500/10 text-amber-600 border-amber-500/20': score.grade === 'C',
                    'bg-red-500/10 text-red-600 border-red-500/20': score.grade === 'D',
                  })}>{score.grade}</Badge>
                </div>
              )}
            </section>
          )}

          <Separator />

          {/* Sinais */}
          {signals.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sinais</h4>
              <div className="flex flex-wrap gap-1.5">
                {signals.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <Separator />

          {/* Duplicidade */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duplicidade</h4>
            <DedupeBadge status={prospect.dedupe_status || 'unchecked'} />
            {prospect.matched_account_id && (
              <div className="text-sm text-muted-foreground mt-1">
                Conta existente: <span className="font-medium text-foreground">{matchedAccountName || prospect.matched_account_id}</span>
              </div>
            )}
          </section>

          <Separator />

          {/* Evidência da Origem */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem</h4>
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">Fonte: {prospect.source_label || '—'}</div>
              {prospect.source_url && (
                <a href={prospect.source_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline">
                  <ExternalLink className="h-3 w-3" />{prospect.source_url}
                </a>
              )}
            </div>
          </section>

          {/* Evento */}
          {prospect.event_name && (
            <>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evento</h4>
                <div className="text-sm space-y-1">
                  <div className="text-muted-foreground">Evento: <span className="font-medium text-foreground">{prospect.event_name}</span></div>
                  {prospect.booth && <div className="text-muted-foreground">Stand: <span className="font-medium text-foreground">{prospect.booth}</span></div>}
                  {prospect.exhibitor_profile_url && (
                    <a href={prospect.exhibitor_profile_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" />Perfil do Expositor
                    </a>
                  )}
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* Ação Recomendada */}
          {prospect.recommended_next_action && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação Recomendada</h4>
              <div className="text-sm font-medium p-2 rounded-md bg-primary/5 border border-primary/10">
                {prospect.recommended_next_action}
              </div>
            </section>
          )}
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t">
          {(prospect.status === 'review_pending' || prospect.approval_status === 'pending') && (
            <>
              <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700" onClick={() => onReject(prospect.id)} disabled={isUpdating}>
                <X className="h-4 w-4 mr-1" />Rejeitar
              </Button>
              <Button className="flex-1" onClick={() => onApprove(prospect.id)} disabled={isUpdating}>
                <Check className="h-4 w-4 mr-1" />Aprovar
              </Button>
            </>
          )}
          {prospect.status === 'approved' && (
            <Button variant="outline" className="w-full" onClick={() => onCreateOpportunity(prospect.id)} disabled={isUpdating}>
              <ArrowRight className="h-4 w-4 mr-1" />Criar Oportunidade
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
