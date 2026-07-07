import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  AlertTriangle,
  Camera,
  Eye,
} from 'lucide-react';
import { useProposalInventoryDemandPreview } from '@/hooks/proposals/useProposalInventoryDemandPreview';
import {
  UNIT_BASIS_UI_LABEL,
  ITEM_KIND_UI_LABEL,
  type ProposalInventoryDemandInputItem,
  type ProposalInventoryDemandInputProposal,
} from '@/lib/proposals/inventoryDemandPreview';
import {
  useProposalInventoryDemandSnapshots,
  useCreateProposalInventoryDemandSnapshot,
} from '@/hooks/proposals/useProposalInventoryDemandSnapshots';
import {
  buildSnapshotSummary,
  buildSourceProducts,
  buildSourceRequirements,
  comparePreviewToSnapshot,
  computePreviewHash,
} from '@/lib/proposals/inventoryDemandSnapshot';
import { ProposalInventoryDemandSnapshotDetails } from './ProposalInventoryDemandSnapshotDetails';
import type { ProposalInventoryDemandSnapshot } from '@/schemas/proposalInventoryDemandSnapshot';
import { toast } from '@/hooks/use-toast';


interface Props {
  proposal: ProposalInventoryDemandInputProposal | null | undefined;
  proposalItems: ProposalInventoryDemandInputItem[];
}

export function ProposalInventoryDemandPreview({ proposal, proposalItems }: Props) {
  const { preview, loading, productRequirements } = useProposalInventoryDemandPreview(
    proposal,
    proposalItems,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsSnapshot, setDetailsSnapshot] = useState<ProposalInventoryDemandSnapshot | null>(null);
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);

  const proposalId = proposal?.id ?? null;
  const snapshotsQuery = useProposalInventoryDemandSnapshots(proposalId);
  const createSnapshot = useCreateProposalInventoryDemandSnapshot();

  const snapshots = snapshotsQuery.data ?? [];
  const latestSnapshot = snapshots[0] ?? null;

  const comparison = useMemo(
    () => comparePreviewToSnapshot(preview, latestSnapshot),
    [preview, latestSnapshot],
  );

  const hasIncompleteOnly =
    preview.lines.length > 0 &&
    preview.lines.every((l) => l.status === 'incomplete' || l.status === 'manual');

  const canSaveSnapshot =
    !!proposalId &&
    (preview.status === 'ready' || preview.status === 'incomplete') &&
    preview.lines.length > 0;

  const disabledReason = !proposalId
    ? 'Salve a proposta antes de gerar um snapshot.'
    : !proposalItems || proposalItems.length === 0
    ? 'Adicione produtos à proposta antes de salvar um snapshot.'
    : preview.lines.length === 0
    ? 'Não há demanda operacional para salvar.'
    : null;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const doSaveSnapshot = async () => {
    if (!proposalId) return;
    try {
      await createSnapshot.mutateAsync({
        proposal_id: proposalId,
        summary: buildSnapshotSummary(preview),
        payload: preview.payload as any,
        lines: preview.lines as any,
        warnings: preview.warnings as any,
        commercial_context: preview.payload.commercial_context as any,
        source_products: buildSourceProducts(preview, proposalItems) as any,
        source_requirements: buildSourceRequirements(preview, productRequirements) as any,
        hash: computePreviewHash(preview),
      });
      toast({ title: 'Snapshot de demanda operacional salvo.' });
    } catch (err: any) {
      toast({
        title: 'Não foi possível salvar o snapshot.',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const handleSaveClick = () => {
    if (!canSaveSnapshot) return;
    if (hasIncompleteOnly || preview.lines.some((l) => l.status === 'incomplete')) {
      setConfirmIncomplete(true);
      return;
    }
    void doSaveSnapshot();
  };


  const header = (
    <CardHeader>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-primary" />
            Demanda operacional
            <Badge variant="secondary" className="ml-1">Preview Eventrix</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Estimativa dos recursos físicos necessários para entregar esta proposta,
            com base na Composição de Inventário dos produtos.
          </p>
        </div>
      </div>
    </CardHeader>
  );

  const infoAlert = (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        Este preview ainda não consulta disponibilidade real no Eventrix.
      </AlertDescription>
    </Alert>
  );

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(preview.payload, null, 2));
      toast({ title: 'Payload copiado', description: 'JSON copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className="text-sm text-muted-foreground">Calculando demanda operacional…</div>
        </CardContent>
      </Card>
    );
  }

  if (preview.status === 'empty') {
    const noItems = !proposalItems || proposalItems.length === 0;
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          {infoAlert}
          <div className="rounded-md border border-dashed p-6 text-center">
            <h3 className="font-medium">
              {noItems ? 'Nenhum produto na proposta' : 'Nenhuma demanda operacional identificada'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {noItems
                ? 'Adicione produtos à proposta para visualizar a demanda operacional estimada.'
                : 'Os produtos desta proposta ainda não possuem Composição de Inventário vinculada ao Eventrix.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {infoAlert}

        {preview.warnings.map((w, i) => (
          <Alert key={i} variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{w}</AlertDescription>
          </Alert>
        ))}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Famílias exigidas" value={preview.totals.requiredFamilies} />
          <Kpi label="Unidades estimadas" value={preview.totals.totalRequiredUnits} />
          <Kpi label="Obrigatórias" value={preview.totals.requiredFamilies} />
          <Kpi label="Opcionais" value={preview.totals.optionalFamilies} />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Categoria</TableHead>
                <TableHead>Família Eventrix</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Necessário</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Cálculo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.lines.map((line) => {
                const open = expanded.has(line.key);
                return (
                  <>
                    <TableRow key={line.key} className="cursor-pointer" onClick={() => toggle(line.key)}>
                      <TableCell>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell>{line.eventrix_category_name}</TableCell>
                      <TableCell className="font-medium">{line.eventrix_family_name}</TableCell>
                      <TableCell>
                        {line.eventrix_item_kind
                          ? ITEM_KIND_UI_LABEL[line.eventrix_item_kind] ?? line.eventrix_item_kind
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {line.status === 'manual'
                          ? 'Manual'
                          : line.status === 'incomplete'
                          ? 'Pendente'
                          : `${line.required_quantity} unidades`}
                      </TableCell>
                      <TableCell>{UNIT_BASIS_UI_LABEL[line.unit_basis]}</TableCell>
                      <TableCell>
                        <Badge variant={line.is_required ? 'default' : 'outline'}>
                          {line.is_required ? 'Obrigatório' : 'Opcional'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {line.calculation_label}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            line.status === 'calculated'
                              ? 'secondary'
                              : line.status === 'manual'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {line.status === 'calculated'
                            ? 'Calculado'
                            : line.status === 'manual'
                            ? 'Manual'
                            : 'Dados incompletos'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow key={`${line.key}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/40">
                          <div className="p-2 space-y-1">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">
                              Origem da demanda
                            </p>
                            {line.source_products.map((s, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium">{s.product_name}</span>
                                {' — '}
                                <span className="text-muted-foreground">{s.calculation_label}</span>
                                {s.required_quantity != null && (
                                  <span className="text-muted-foreground">
                                    {' = '}
                                    {s.required_quantity} unidades
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Snapshot section */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Snapshot operacional
              </div>
              <p className="text-xs text-muted-foreground max-w-xl mt-0.5">
                Congela a demanda operacional atual desta proposta para histórico e
                validação futura.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {comparison === 'aligned' && (
                <Badge variant="secondary">Sem alterações</Badge>
              )}
              {comparison === 'changed' && (
                <Badge variant="destructive">Preview alterado</Badge>
              )}
              <Button
                size="sm"
                onClick={handleSaveClick}
                disabled={!canSaveSnapshot || createSnapshot.isPending}
                title={disabledReason ?? 'Salvar snapshot'}
              >
                <Camera className="h-3 w-3 mr-1" />
                {createSnapshot.isPending ? 'Salvando…' : 'Salvar snapshot'}
              </Button>
            </div>
          </div>

          {comparison === 'aligned' && (
            <p className="text-xs text-muted-foreground">
              O preview atual está alinhado com o último snapshot salvo.
            </p>
          )}
          {comparison === 'changed' && (
            <p className="text-xs text-muted-foreground">
              A demanda operacional atual mudou desde o último snapshot salvo.
            </p>
          )}

          {/* Latest snapshot card */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Último snapshot salvo
            </div>
            {!latestSnapshot ? (
              <div className="text-sm">
                <div className="font-medium">Nenhum snapshot salvo ainda</div>
                <p className="text-muted-foreground text-xs mt-1">
                  Salve um snapshot para congelar a demanda operacional estimada desta
                  proposta.
                </p>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Snapshot v{latestSnapshot.snapshot_version}</span>
                  <Badge variant="outline" className="text-xs">
                    {latestSnapshot.status === 'preview_snapshot' ? 'Preview' : latestSnapshot.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Salvo em {new Date(latestSnapshot.created_at).toLocaleString('pt-BR')}
                </div>
                <div className="text-xs">
                  Famílias exigidas: {(latestSnapshot.summary as any)?.required_families ?? 0}
                  {' • '}
                  Unidades estimadas: {(latestSnapshot.summary as any)?.total_required_units ?? 0}
                  {' • '}
                  Avisos: {Array.isArray(latestSnapshot.warnings) ? latestSnapshot.warnings.length : 0}
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailsSnapshot(latestSnapshot)}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Ver detalhes
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {snapshots.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left text-sm py-1"
                >
                  <span className="font-medium">
                    Histórico de snapshots ({snapshots.length})
                  </span>
                  {historyOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-md border overflow-x-auto mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Versão</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Famílias</TableHead>
                        <TableHead>Unidades</TableHead>
                        <TableHead>Avisos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.slice(0, 5).map((snap) => {
                        const sum = snap.summary as any;
                        return (
                          <TableRow key={snap.id}>
                            <TableCell className="font-medium">v{snap.snapshot_version}</TableCell>
                            <TableCell className="text-xs">
                              {new Date(snap.created_at).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>{sum?.required_families ?? 0}</TableCell>
                            <TableCell>{sum?.total_required_units ?? 0}</TableCell>
                            <TableCell>
                              {Array.isArray(snap.warnings) ? snap.warnings.length : 0}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {snap.status === 'preview_snapshot' ? 'Preview' : snap.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDetailsSnapshot(snap)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Ver payload
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
          <div className="rounded-md border">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div>
                  <div className="font-medium text-sm">Payload futuro para Eventrix</div>
                  <div className="text-xs text-muted-foreground">
                    Prévia técnica do payload que será enviado ao Eventrix quando a consulta real
                    de disponibilidade estiver ativa.
                  </div>
                </div>
                {payloadOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t p-3 space-y-2">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={copyPayload}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar payload
                  </Button>
                </div>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-96">
{JSON.stringify(preview.payload, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </CardContent>

      <ProposalInventoryDemandSnapshotDetails
        open={!!detailsSnapshot}
        onOpenChange={(o) => !o && setDetailsSnapshot(null)}
        snapshot={detailsSnapshot}
      />

      <AlertDialog open={confirmIncomplete} onOpenChange={setConfirmIncomplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar snapshot mesmo assim?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem dados incompletos no preview. Deseja salvar o snapshot mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmIncomplete(false);
                void doSaveSnapshot();
              }}
            >
              Salvar snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
