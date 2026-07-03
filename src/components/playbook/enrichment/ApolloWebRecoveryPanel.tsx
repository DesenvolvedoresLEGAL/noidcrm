import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ClipboardPaste, RefreshCw, AlertTriangle, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addApolloManualContact,
  buildApolloWebUrl,
  getApolloZeroResultStats,
  parseManualContacts,
  type ParsedManualContact,
} from '@/services/intelligence/apolloBrowserParity';

interface ApolloWebRecoveryPanelProps {
  prospectId: string;
  organizationId: string;
  companyName: string | null | undefined;
  domain: string | null | undefined;
  apolloWebUrl: string | null | undefined;
  onRetryApi: () => void;
  isRetrying: boolean;
}

export function ApolloWebRecoveryPanel({
  prospectId,
  organizationId,
  companyName,
  domain,
  apolloWebUrl,
  onRetryApi,
  isRetrying,
}: ApolloWebRecoveryPanelProps) {
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['apollo-zero-stats', prospectId],
    queryFn: () => getApolloZeroResultStats(prospectId),
    enabled: !!prospectId,
    staleTime: 60_000,
  });

  const url = useMemo(
    () => buildApolloWebUrl({ storedUrl: apolloWebUrl, domain, companyName }),
    [apolloWebUrl, domain, companyName],
  );

  const openApollo = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const blocked = !!stats?.blocked;

  return (
    <>
      <Card className="p-4 space-y-3 border-dashed">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-foreground">
              A API do Apollo não retornou contatos, mas o Apollo Web pode ter resultados.
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Se você vê contatos no Apollo Web para esta empresa, use o modo assistido — abra a listagem,
              copie os contatos e cole aqui. Sem consumir créditos.
            </p>
            {blocked && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-500/5 border border-red-500/30 px-2 py-1.5 text-[11px] text-red-700">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Créditos bloqueados por 24h</strong> — Apollo API retornou 0 com consumo de créditos{' '}
                  {stats?.zeroWithCreditsCount}x nas últimas 24h. Use o Apollo Web Assistido.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button onClick={openApollo} className="gap-1.5" size="sm">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir no Apollo
          </Button>
          <Button onClick={() => setImportOpen(true)} variant="secondary" size="sm" className="gap-1.5">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Importar contatos vistos
          </Button>
          <Button
            onClick={onRetryApi}
            variant="outline"
            size="sm"
            disabled={isRetrying || blocked}
            className="gap-1.5"
            title={blocked ? 'Bloqueado por proteção de crédito (24h)' : 'Tentar API Apollo novamente'}
          >
            {isRetrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Tentar API novamente
          </Button>
        </div>
      </Card>

      <ImportContactsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        prospectId={prospectId}
        organizationId={organizationId}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] });
        }}
      />
    </>
  );
}

function ImportContactsDialog({
  open,
  onOpenChange,
  prospectId,
  organizationId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string;
  organizationId: string;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const parsed: ParsedManualContact[] = useMemo(() => parseManualContacts(text), [text]);

  const handleImport = async () => {
    if (parsed.length === 0) {
      toast.info('Cole ao menos um contato para importar');
      return;
    }
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const c of parsed) {
      try {
        await addApolloManualContact({
          prospect_id: prospectId,
          workspace_id: organizationId,
          full_name: c.full_name,
          role_title: c.role_title,
          email: c.email,
          phone: c.phone,
          linkedin_url: c.linkedin_url,
          note: 'Colado do Apollo Web (KAI.18.9 recovery)',
        });
        ok++;
      } catch (e) {
        console.error('[apollo-web-manual] import failed', e);
        fail++;
      }
    }
    setImporting(false);
    if (ok > 0) toast.success(`${ok} contato(s) importado(s) do Apollo Web`);
    if (fail > 0) toast.error(`${fail} contato(s) falharam ao importar`);
    if (ok > 0) {
      onImported();
      setText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos vistos no Apollo</DialogTitle>
          <DialogDescription>
            Cole os contatos copiados do Apollo Web. Uma linha por contato — pode usar Tab, <code>|</code>, <code>;</code> ou vírgula.
            Ordem sugerida: <strong>Nome | Cargo | Email | Telefone | LinkedIn</strong>. Email, telefone e LinkedIn são detectados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`João Silva | CTO | joao@empresa.com | +55 11 99999-1234 | https://linkedin.com/in/joao\nMaria Souza\tHead of Sales\tmaria@empresa.com\t+55 11 98888-4321`}
          className="font-mono text-xs"
        />

        {parsed.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              Pré-visualização: <strong className="text-foreground">{parsed.length}</strong> contato(s) detectado(s)
            </div>
            {parsed.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="font-medium truncate">{p.full_name}</span>
                {p.role_title && <span className="text-muted-foreground truncate">· {p.role_title}</span>}
                <div className="ml-auto flex gap-1">
                  {p.email && <Badge variant="outline" className="text-[9px]">email</Badge>}
                  {p.phone && <Badge variant="outline" className="text-[9px]">tel</Badge>}
                  {p.linkedin_url && <Badge variant="outline" className="text-[9px]">in</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">
          Contatos serão marcados como <strong>manual_import</strong>, provider <code>apollo_web_manual</code>,
          requerendo validação. Não consome créditos.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={importing || parsed.length === 0} className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
            Importar {parsed.length > 0 ? `${parsed.length} ` : ''}contato(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
