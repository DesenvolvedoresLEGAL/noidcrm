import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { ProposalInventoryDemandSnapshot } from '@/schemas/proposalInventoryDemandSnapshot';
import { UNIT_BASIS_UI_LABEL } from '@/lib/proposals/inventoryDemandPreview';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ProposalInventoryDemandSnapshot | null;
  createdByName?: string | null;
}

export function ProposalInventoryDemandSnapshotDetails({
  open,
  onOpenChange,
  snapshot,
  createdByName,
}: Props) {
  const [tab, setTab] = useState('summary');

  const lines = useMemo<any[]>(() => (snapshot?.lines as any[]) ?? [], [snapshot]);
  const warnings = useMemo<any[]>(() => (snapshot?.warnings as any[]) ?? [], [snapshot]);

  if (!snapshot) return null;

  const s = snapshot.summary as any;

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot.payload, null, 2));
      toast({ title: 'Payload copiado', description: 'JSON copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Snapshot de Demanda Operacional</DialogTitle>
          <DialogDescription>
            Registro congelado da demanda operacional estimada no momento da proposta.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="lines">Linhas</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="warnings">Avisos</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-2 text-sm">
            <SummaryRow k="Versão" v={`v${snapshot.snapshot_version}`} />
            <SummaryRow k="Status" v={snapshot.status} />
            <SummaryRow k="Algoritmo" v={snapshot.algorithm_version} />
            <SummaryRow k="Criado em" v={new Date(snapshot.created_at).toLocaleString('pt-BR')} />
            <SummaryRow k="Criado por" v={createdByName ?? snapshot.created_by ?? '—'} />
            <SummaryRow k="Famílias exigidas" v={String(s?.required_families ?? 0)} />
            <SummaryRow k="Unidades estimadas" v={String(s?.total_required_units ?? 0)} />
            <SummaryRow k="Linhas obrigatórias" v={String(s?.required_lines ?? 0)} />
            <SummaryRow k="Linhas opcionais" v={String(s?.optional_lines ?? 0)} />
            <SummaryRow k="Linhas manuais" v={String(s?.manual_lines ?? 0)} />
            <SummaryRow k="Linhas incompletas" v={String(s?.incomplete_lines ?? 0)} />
          </TabsContent>

          <TabsContent value="lines">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        Nenhuma linha registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{l.eventrix_category_name}</TableCell>
                      <TableCell className="font-medium">{l.eventrix_family_name}</TableCell>
                      <TableCell>{l.eventrix_item_kind ?? '—'}</TableCell>
                      <TableCell>
                        {l.status === 'manual'
                          ? 'Manual'
                          : l.status === 'incomplete'
                          ? 'Pendente'
                          : `${l.required_quantity} unidades`}
                      </TableCell>
                      <TableCell>{UNIT_BASIS_UI_LABEL[l.unit_basis as keyof typeof UNIT_BASIS_UI_LABEL] ?? l.unit_basis}</TableCell>
                      <TableCell>
                        <Badge variant={l.is_required ? 'default' : 'outline'}>
                          {l.is_required ? 'Obrigatório' : 'Opcional'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {l.calculation_label}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            l.status === 'calculated'
                              ? 'secondary'
                              : l.status === 'manual'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {l.status === 'calculated'
                            ? 'Calculado'
                            : l.status === 'manual'
                            ? 'Manual'
                            : 'Dados incompletos'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payload" className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={copyPayload}>
                <Copy className="h-3 w-3 mr-1" /> Copiar payload
              </Button>
            </div>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-[60vh]">
{JSON.stringify(snapshot.payload, null, 2)}
            </pre>
          </TabsContent>

          <TabsContent value="warnings">
            {warnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso registrado.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {warnings.map((w, i) => (
                  <li key={i}>{typeof w === 'string' ? w : JSON.stringify(w)}</li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
