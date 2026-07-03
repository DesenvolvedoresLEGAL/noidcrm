import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, AlertTriangle, Globe, MapPin, Building2, ExternalLink, Download, PackageCheck, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Prospect } from '@/hooks/useLeadSourcingV2';
import { useEnrichmentRun, useEnrichedCompanyProfile, useCommercialBrief, useEnrichmentSignals, useRunEnrichment } from '@/hooks/useEnrichment';
import { useEnrichProspectIdentity } from '@/hooks/useEnrichProspectIdentity';
import { hasMinimumIdentity } from '@/hooks/useProspectImport';
import { EnrichProspectButton } from './enrichment/EnrichProspectButton';
import { EnrichmentStatusBadge } from './enrichment/EnrichmentStatusBadge';
import { CompanyEnrichmentCard } from './enrichment/CompanyEnrichmentCard';
import { CommercialBriefCard } from './enrichment/CommercialBriefCard';
import { EnrichmentSignalsList } from './enrichment/EnrichmentSignalsList';
import { EnrichmentTimeline } from './enrichment/EnrichmentTimeline';
import { DecisionDetailPanel } from '@/components/decision-engine/DecisionDetailPanel';
import { ProspectLifecycleTimeline } from '@/components/learning/ProspectLifecycleTimeline';
import { ProspectContactsTab } from './ProspectContactsTab';
import { EnrichmentJobsTable } from './enrichment/EnrichmentJobsTable';
import { ApolloInspectorTab } from './ApolloInspectorTab';
import { ApolloBrowserParityTab } from './ApolloBrowserParityTab';
import { ApolloEndpointMatrixTab } from './ApolloEndpointMatrixTab';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface ProspectDetailDrawerProps {
  prospect: Prospect | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCreateOpportunity: (id: string) => void;
  onImport: (prospect: Prospect) => void;
  isUpdating: boolean;
  isImporting: boolean;
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
  onImport,
  isUpdating,
  isImporting,
  matchedAccountName,
}: ProspectDetailDrawerProps) {
  const { roles } = useCurrentUser();
  const isAdmin = !!roles?.some((r: string) => ['admin', 'owner', 'platform_admin'].includes(r));
  if (!prospect) return null;

  const score = prospect.prospect_scores?.[0];
  const reasoning = score?.reasoning as any;
  const signals: string[] = reasoning?.signals || [];
  const totalScore = score
    ? (score.icp_fit_score || 0) + (score.signal_score || 0) + (score.data_quality_score || 0) + (score.source_trust_score || 0) - (score.penalty_score || 0)
    : 0;

  const isImported = prospect.approval_status === 'imported' || prospect.status === 'converted';
  const isApproved = prospect.status === 'approved' || prospect.approval_status === 'approved';

  // Enrichment hooks
  const { data: enrichmentRun } = useEnrichmentRun(prospect.id);
  const { data: companyProfile } = useEnrichedCompanyProfile(prospect.id);
  const { data: commercialBrief } = useCommercialBrief(prospect.id);
  const { data: enrichmentSignals } = useEnrichmentSignals(prospect.id);
  const runEnrichment = useRunEnrichment();
  const enrichIdentity = useEnrichProspectIdentity();

  const minimumIdentity = hasMinimumIdentity(prospect);
  const identityEnriched = !!prospect.identity_enriched_at;

  const handleEnrich = () => {
    if (prospect.organization_id) {
      runEnrichment.mutate({
        prospectId: prospect.id,
        workspaceId: prospect.organization_id,
      });
    }
  };

  const handleForceFallback = () => {
    if (prospect.organization_id) {
      runEnrichment.mutate({
        prospectId: prospect.id,
        workspaceId: prospect.organization_id,
        forceFallback: true,
      });
    }
  };

  const handleEnrichAndImport = async () => {
    try {
      const result = await enrichIdentity.mutateAsync(prospect.id);
      const enrichedProspect = { ...prospect, ...(result?.updates || {}) } as Prospect;

      if (!hasMinimumIdentity(enrichedProspect)) {
        toast.error('Enriquecimento concluído, mas ainda sem CNPJ ou domínio para importar.');
        return;
      }

      onImport(enrichedProspect);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{prospect.company_name}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1">Contatos</TabsTrigger>
            <TabsTrigger value="apollo" className="flex-1">Apollo</TabsTrigger>
            <TabsTrigger value="parity" className="flex-1">Parity</TabsTrigger>
            <TabsTrigger value="matrix" className="flex-1">Matrix</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
            <TabsTrigger value="enrichment" className="flex-1">Enrichment</TabsTrigger>
            <TabsTrigger value="decision" className="flex-1">Decisão</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="apollo">
            <div className="py-4">
              <ApolloInspectorInline prospectId={prospect.id} />
            </div>
          </TabsContent>

          <TabsContent value="parity">
            <div className="py-4">
              <ApolloBrowserParityTab
                prospectId={prospect.id}
                companyName={prospect.company_name}
                domain={(prospect as any).normalized_domain}
              />
            </div>
          </TabsContent>

          <TabsContent value="matrix">
            <div className="py-4">
              <ApolloEndpointMatrixTab prospectId={prospect.id} />
            </div>
          </TabsContent>


          <TabsContent value="contacts">
            <ProspectContactsTab
              prospectId={prospect.id}
              decisionMakerFound={(prospect as any).decision_maker_found}
              enrichmentStatus={(prospect as any).enrichment_status}
              contactScore={(prospect as any).contact_score}
              matchedAccountId={prospect.matched_account_id}
            />
          </TabsContent>

          <TabsContent value="history">
            <div className="py-4">
              <EnrichmentJobsTable prospectId={prospect.id} />
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="space-y-6 py-4">
              {isImported && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  <div className="text-sm">
                    <span className="font-medium text-primary">Importado no CRM</span>
                    {prospect.matched_account_id && (
                      <span className="text-muted-foreground ml-1">
                        — Conta: {matchedAccountName || prospect.matched_account_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!isImported && !minimumIdentity && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-amber-700">Faltam dados essenciais</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      Sem CNPJ ou domínio, não é possível criar conta no CRM. Use <strong>Enriquecer & Importar</strong> abaixo para descobrir esses dados via Google + lookup CNPJ.
                    </div>
                  </div>
                </div>
              )}

              {(prospect.cnpj || prospect.razao_social) && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider">Identidade enriquecida</div>
                  {prospect.razao_social && <div><span className="text-muted-foreground">Razão social:</span> <span className="font-medium">{prospect.razao_social}</span></div>}
                  {prospect.cnpj && <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{prospect.cnpj}</span></div>}
                  {prospect.cnae_desc && <div><span className="text-muted-foreground">CNAE:</span> {prospect.cnae_desc}</div>}
                  {prospect.porte && <div><span className="text-muted-foreground">Porte:</span> {prospect.porte}</div>}
                </div>
              )}

              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {prospect.normalized_domain && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" /><span>{prospect.normalized_domain}</span>
                    </div>
                  )}
                  {prospect.city && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /><span>{prospect.city}{prospect.state ? `, ${prospect.state}` : ''}</span>
                    </div>
                  )}
                  {prospect.industry && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" /><span>{prospect.industry}</span>
                    </div>
                  )}
                </div>
                {prospect.summary && <p className="text-sm text-muted-foreground">{prospect.summary}</p>}
              </section>

              <Separator />

              {score && (
                <section className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h4>
                  <div className="space-y-2.5">
                    <ScoreBar label="ICP Fit" value={score.icp_fit_score || 0} />
                    <ScoreBar label="Sinais" value={score.signal_score || 0} />
                    <ScoreBar label="Qualidade de Dados" value={score.data_quality_score || 0} />
                    <ScoreBar label="Confiança da Fonte" value={score.source_trust_score || 0} />
                    {(score.penalty_score || 0) > 0 && <ScoreBar label="Penalidade" value={score.penalty_score || 0} />}
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

              {signals.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sinais</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {signals.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </section>
              )}

              <Separator />

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

              {prospect.recommended_next_action && (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação Recomendada</h4>
                  <div className="text-sm font-medium p-2 rounded-md bg-primary/5 border border-primary/10">
                    {prospect.recommended_next_action}
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          <TabsContent value="enrichment">
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <EnrichProspectButton
                  hasRun={!!enrichmentRun}
                  isLoading={runEnrichment.isPending}
                  onClick={handleEnrich}
                  onForceFallback={handleForceFallback}
                />
                <EnrichmentStatusBadge status={enrichmentRun?.status} />
              </div>

              {companyProfile && <CompanyEnrichmentCard profile={companyProfile} run={enrichmentRun as any} /> }
              {commercialBrief && <CommercialBriefCard brief={commercialBrief} />}
              {enrichmentSignals && enrichmentSignals.length > 0 && <EnrichmentSignalsList signals={enrichmentSignals} />}
              <EnrichmentTimeline
                run={enrichmentRun}
                hasProfile={!!companyProfile}
                hasBrief={!!commercialBrief}
              />

              {!enrichmentRun && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Clique em "Enriquecer com IA" para iniciar a análise deste prospect.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="decision">
            <div className="py-4">
              <DecisionDetailPanel prospectId={prospect.id} enrichmentRunId={enrichmentRun?.id} />
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="py-4">
              <ProspectLifecycleTimeline prospectId={prospect.id} />
            </div>
          </TabsContent>
        </Tabs>

        {isApproved && !isImported && minimumIdentity && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 mt-3 space-y-1.5 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <PackageCheck className="h-3.5 w-3.5 text-primary" />
              O que será criado no CRM (pipeline PRÉ VENDAS)
            </div>
            <ul className="space-y-1 text-muted-foreground pl-1">
              <li>• <strong>Conta</strong> — {prospect.razao_social || prospect.company_name}{prospect.cnpj ? ` (CNPJ ${prospect.cnpj})` : ''}</li>
              <li>• <strong>Oportunidade</strong> na 1ª etapa, com perfil completo da empresa nos metadados</li>
              <li>• <strong>Nota inicial</strong> com brief comercial estruturado (resumo, dores, hipóteses, sinais)</li>
              {commercialBrief?.first_touch_message && (
                <li>• <strong>E-mail inicial disparado automaticamente</strong> via seu SMTP (ou rascunho na timeline se SMTP não estiver configurado)</li>
              )}
            </ul>
          </div>
        )}

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
          {isApproved && !isImported && (
            <div className="w-full flex flex-col gap-2">
              {!minimumIdentity ? (
                <Button
                  className="w-full"
                  onClick={handleEnrichAndImport}
                  disabled={enrichIdentity.isPending || isImporting}
                >
                  {enrichIdentity.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enriquecendo identidade…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" />Enriquecer & Importar</>
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => enrichIdentity.mutate(prospect.id)}
                    disabled={enrichIdentity.isPending}
                    title={identityEnriched ? 'Re-enriquecer identidade' : 'Enriquecer identidade'}
                  >
                    {enrichIdentity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  <Button className="flex-1" onClick={() => onImport(prospect)} disabled={isImporting}>
                    <Download className="h-4 w-4 mr-1" />
                    {isImporting ? 'Importando…' : 'Importar no CRM'}
                  </Button>
                </div>
              )}
            </div>
          )}
          {isImported && (
            <div className="w-full text-center text-sm text-muted-foreground py-2">
              <PackageCheck className="h-4 w-4 inline mr-1" />
              Já importado no CRM
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ApolloInspectorInline({ prospectId }: { prospectId: string }) {
  const { roles } = useCurrentUser();
  const isAdmin = roles?.includes('admin') || roles?.includes('owner');
  return <ApolloInspectorTab prospectId={prospectId} isAdmin={isAdmin} />;
}
