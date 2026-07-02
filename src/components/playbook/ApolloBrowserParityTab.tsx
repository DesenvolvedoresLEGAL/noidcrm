import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, Plus, Upload, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  runApolloParityCheck,
  listApolloParityLogs,
  addApolloManualContact,
  type ApolloParityLog,
} from '@/services/intelligence/apolloBrowserParity';

interface Props {
  prospectId: string;
  companyName?: string | null;
  domain?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  match: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  mismatch: 'bg-red-500/10 text-red-700 border-red-500/30',
  payload_mismatch: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  endpoint_mismatch: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  api_limitation: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  auth_scope_mismatch: 'bg-red-500/10 text-red-700 border-red-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
  no_har: 'bg-muted text-muted-foreground border-border',
};

export function ApolloBrowserParityTab({ prospectId, companyName, domain }: Props) {
  const qc = useQueryClient();
  const { organization } = useCurrentUser();
  const [webCount, setWebCount] = useState<string>('');
  const [webUrl, setWebUrl] = useState<string>('');
  const [harText, setHarText] = useState<string>('');
  const [manualOpen, setManualOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery<ApolloParityLog[]>({
    queryKey: ['apollo-parity-logs', prospectId],
    queryFn: () => listApolloParityLogs(prospectId),
    enabled: !!prospectId,
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      let har_json: any = undefined;
      if (harText.trim()) {
        try {
          har_json = JSON.parse(harText);
        } catch {
          throw new Error('HAR JSON inválido');
        }
      }
      return await runApolloParityCheck({
        prospect_id: prospectId,
        apollo_web_contacts_count: webCount ? Number(webCount) : null,
        apollo_web_url: webUrl || null,
        har_json,
      });
    },
    onSuccess: (data) => {
      toast.success(`Parity check: ${data.parity_status}${data.root_cause ? ` — ${data.root_cause}` : ''}`);
      qc.invalidateQueries({ queryKey: ['apollo-parity-logs', prospectId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao rodar parity check'),
  });

  const latest = logs[0];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Apollo Browser Parity</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Compare o que o Apollo Web mostra com o que o Kairós recebe da API.
              Se houver HAR exportado do DevTools, cole abaixo para diff detalhado.
            </p>
          </div>
          <ManualImportDialog
            open={manualOpen}
            onOpenChange={setManualOpen}
            prospectId={prospectId}
            workspaceId={organization?.id ?? ''}
            onSaved={() => qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Contatos vistos no Apollo Web</Label>
            <Input
              type="number"
              min={0}
              placeholder="Ex: 6"
              value={webCount}
              onChange={(e) => setWebCount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Apollo Web URL</Label>
            <Input
              placeholder="https://app.apollo.io/#/organizations/..."
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">HAR JSON (opcional)</Label>
          <Textarea
            rows={4}
            placeholder='Exporte do DevTools > Network > "Export HAR" e cole aqui'
            value={harText}
            onChange={(e) => setHarText(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            <Upload className="inline h-3 w-3 mr-1" />
            Extrai chamadas Apollo relevantes (people, mixed_people, organizations, search).
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
            Rodar Browser Parity
          </Button>
          {webUrl && (
            <Button size="sm" variant="outline" asChild className="gap-2">
              <a href={webUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Apollo Web
              </a>
            </Button>
          )}
        </div>
      </Card>

      {latest && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Última verificação</h4>
            <Badge className={STATUS_STYLES[latest.parity_status] ?? STATUS_STYLES.unknown}>
              {latest.parity_status}
            </Badge>
          </div>

          {latest.parity_status !== 'match' && latest.parity_status !== 'unknown' && latest.root_cause && (
            <Alert className="border-amber-500/40 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                <strong>Root cause:</strong> {latest.root_cause}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Metric label="Apollo Web" value={latest.apollo_web_contacts_count ?? '—'} />
            <Metric label="Kairós" value={latest.kairos_contacts_count ?? 0} highlight={latest.kairos_contacts_count === 0} />
            <Metric label="Créditos" value={latest.kairos_credits_used ?? 0} />
            <Metric label="Endpoint" value={latest.kairos_endpoint?.split('/').pop() ?? '—'} />
          </div>

          {latest.diff_summary && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold">Diff de payload</h5>
              {latest.diff_summary.only_web?.length > 0 && (
                <div className="text-xs">
                  <span className="text-emerald-700 font-medium">Presente no Web, ausente no Kairós:</span>{' '}
                  <code className="text-[11px]">{latest.diff_summary.only_web.join(', ')}</code>
                </div>
              )}
              {latest.diff_summary.only_kairos?.length > 0 && (
                <div className="text-xs">
                  <span className="text-red-700 font-medium">Presente no Kairós, ausente no Web:</span>{' '}
                  <code className="text-[11px]">{latest.diff_summary.only_kairos.join(', ')}</code>
                </div>
              )}
              {latest.diff_summary.different?.length > 0 && (
                <div className="text-xs">
                  <span className="text-amber-700 font-medium">Diferentes:</span>
                  <ul className="mt-1 space-y-0.5">
                    {latest.diff_summary.different.slice(0, 5).map((d: any) => (
                      <li key={d.key} className="text-[11px] font-mono">
                        <strong>{d.key}:</strong> {JSON.stringify(d.kairos)} ↔ {JSON.stringify(d.web)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {latest.har_uploaded && Array.isArray(latest.har_candidate_requests) && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold">
                Chamadas Apollo detectadas no HAR ({latest.har_candidate_requests.length})
              </summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {latest.har_candidate_requests.map((r: any, i: number) => (
                  <li key={i} className="border rounded px-2 py-1">
                    <div className="font-mono text-[11px] truncate">
                      {r.method} {r.url}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      status={r.status} · people={r.response_summary?.people_count ?? '—'}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      {!isLoading && logs.length > 1 && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">Histórico</h4>
          <ul className="space-y-1 text-xs">
            {logs.slice(1, 6).map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b py-1 last:border-0">
                <span className="text-[11px] text-muted-foreground">
                  {new Date(l.created_at).toLocaleString('pt-BR')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">Web {l.apollo_web_contacts_count ?? '—'} · Kairós {l.kairos_contacts_count ?? 0}</span>
                  <Badge variant="outline" className="text-[10px]">{l.parity_status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? 'border-red-500/40 bg-red-500/5' : ''}`}>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

interface ManualDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string;
  workspaceId: string;
  onSaved?: () => void;
}

function ManualImportDialog({ open, onOpenChange, prospectId, workspaceId, onSaved }: ManualDialogProps) {
  const [form, setForm] = useState({
    full_name: '', role_title: '', department: '', linkedin_url: '',
    email: '', phone: '', note: '',
  });
  const mut = useMutation({
    mutationFn: () => addApolloManualContact({
      prospect_id: prospectId,
      workspace_id: workspaceId,
      full_name: form.full_name,
      role_title: form.role_title || null,
      department: form.department || null,
      linkedin_url: form.linkedin_url || null,
      email: form.email || null,
      phone: form.phone || null,
      note: form.note || null,
    }),
    onSuccess: () => {
      toast.success('Contato Apollo importado manualmente');
      onSaved?.();
      onOpenChange(false);
      setForm({ full_name: '', role_title: '', department: '', linkedin_url: '', email: '', phone: '', note: '' });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao importar'),
  });

  const set = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Contato manual do Apollo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar contato manual do Apollo</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.full_name} onChange={set('full_name')} />
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <Input value={form.role_title} onChange={set('role_title')} />
            </div>
            <div>
              <Label className="text-xs">Departamento</Label>
              <Input value={form.department} onChange={set('department')} />
            </div>
            <div>
              <Label className="text-xs">LinkedIn</Label>
              <Input value={form.linkedin_url} onChange={set('linkedin_url')} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={form.email} onChange={set('email')} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={form.note} onChange={set('note')} />
          </div>
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Origem: Apollo Web manual. Confiança: 70. Marcado como requer validação.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.full_name || mut.isPending}>
            Salvar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
