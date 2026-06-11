import { useAutopilotItems, useAutopilotLogs, useAutopilotRun } from '@/hooks/intelligence/useAutopilot';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Props { runId: string | null; open: boolean; onClose: () => void }

const ITEM_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline', running: 'default', done: 'secondary', skipped: 'outline', failed: 'destructive',
};

export function AutopilotRunDrawer({ runId, open, onClose }: Props) {
  const { data: run } = useAutopilotRun(runId);
  const { data: items, isLoading: itemsLoading } = useAutopilotItems(runId);
  const { data: logs, isLoading: logsLoading } = useAutopilotLogs(runId);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{run?.run_name ?? 'Execução do Autopilot'}</SheetTitle>
          <SheetDescription>
            {run ? `${run.processed} processados · ${run.skipped} pulados · ${run.failed} falhas · ${run.credits_used} créditos` : '…'}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="items" className="mt-4">
          <TabsList>
            <TabsTrigger value="items">Itens ({items?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="logs">Logs ({logs?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-3">
            {itemsLoading ? <Skeleton className="h-48" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.prospect_id.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{it.current_stage}</Badge></TableCell>
                      <TableCell><Badge variant={ITEM_STATUS_VARIANT[it.status]}>{it.status}</Badge></TableCell>
                      <TableCell>{it.priority_rank}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{it.message ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-3">
            {logsLoading ? <Skeleton className="h-48" /> : (
              <div className="space-y-1 font-mono text-xs">
                {logs?.map((l) => (
                  <div key={l.id} className="flex gap-2 py-1 border-b">
                    <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleTimeString('pt-BR')}</span>
                    <span className="font-semibold">{l.action}</span>
                    <span className={l.result === 'failed' ? 'text-destructive' : 'text-emerald-600'}>{l.result}</span>
                    {l.prospect_id && <span className="text-muted-foreground">{l.prospect_id.slice(0, 8)}</span>}
                    {Object.keys(l.details ?? {}).length > 0 && (
                      <span className="text-muted-foreground truncate">{JSON.stringify(l.details)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
