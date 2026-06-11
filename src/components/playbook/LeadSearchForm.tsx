import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Rocket, MapPin, Globe, Users, FileUp, CalendarDays, AlertCircle, Target } from 'lucide-react';
import { useIcpIntelligence, type IntelligenceICP } from '@/hooks/intelligence/useIcpIntelligence';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

/**
 * Sanitiza e valida a URL do evento.
 * Remove espaços e texto adicional após a URL, garante protocolo,
 * e retorna { url, error } onde url é null se inválida.
 */
function sanitizeEventUrl(raw: string): { url: string | null; error: string | null } {
  if (!raw) return { url: null, error: 'Informe a URL do evento' };
  let value = String(raw).trim();
  if (!value) return { url: null, error: 'Informe a URL do evento' };

  // Pega só o primeiro "token" (até o primeiro espaço) — protege contra
  // colagens do tipo "https://x.com/lista e validar que ..."
  const firstToken = value.split(/\s+/)[0];
  if (firstToken !== value) {
    value = firstToken;
  }

  // Remove caracteres finais perigosos (vírgulas, pontos, aspas)
  value = value.replace(/[",;]+$/g, '');

  // Adiciona protocolo se faltar
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return { url: null, error: 'A URL deve usar http ou https' };
    }
    if (!u.hostname || !u.hostname.includes('.')) {
      return { url: null, error: 'Domínio inválido na URL do evento' };
    }
    return { url: u.toString(), error: null };
  } catch {
    return { url: null, error: 'URL inválida. Cole o link completo da página de expositores' };
  }
}

const SEARCH_TYPES = [
  { id: 'event', label: 'Evento (Expositores)', icon: CalendarDays, description: 'Encontre leads a partir de eventos e feiras', status: 'live' as const },
  { id: 'import', label: 'Lista Importada', icon: FileUp, description: 'Analise uma lista existente', status: 'live' as const },
  { id: 'directory', label: 'Diretórios', icon: Globe, description: 'Busque em diretórios de empresas', status: 'wip' as const },
  { id: 'geo', label: 'Busca Geográfica', icon: MapPin, description: 'Prospecção por localização', status: 'wip' as const },
  { id: 'seed', label: 'Seed Expansion', icon: Users, description: 'Encontre empresas similares', status: 'wip' as const },
];

interface LeadSearchFormProps {
  onExecute: (params: {
    playbookType: string;
    icpProfileId: string | null;
    inputPayload: Record<string, any>;
    importRules: {
      approvalMode: string;
      scoreThreshold: number;
      autoImport: boolean;
      autoCreateOpportunity: boolean;
      autoAssignOwner: boolean;
    };
  }) => void;
  isExecuting: boolean;
}

export function LeadSearchForm({ onExecute, isExecuting }: LeadSearchFormProps) {
  const [playbookType, setPlaybookType] = useState('event');
  const [selectedIcpId, setSelectedIcpId] = useState<string | null>(null);
  const [inputPayload, setInputPayload] = useState<Record<string, any>>({});
  const [scoreThreshold, setScoreThreshold] = useState(60);
  const [approvalMode, setApprovalMode] = useState('manual');
  const [autoImport, setAutoImport] = useState(false);
  const [autoCreateOpportunity, setAutoCreateOpportunity] = useState(false);
  const [autoAssignOwner, setAutoAssignOwner] = useState(false);

  const { data: icps } = useIcpIntelligence();
  const selectedIcp: IntelligenceICP | undefined = icps?.find(i => i.id === selectedIcpId);

  const updatePayload = (key: string, value: any) => {
    setInputPayload(prev => ({ ...prev, [key]: value }));
  };

  // Quando o ICP muda, sugere segment/city/state nos parâmetros (sem sobrescrever valores já digitados)
  const handleIcpChange = (id: string) => {
    setSelectedIcpId(id || null);
    const icp = icps?.find(i => i.id === id);
    if (!icp) return;
    setInputPayload(prev => ({
      segment: prev.segment || icp.filterHints.segment || '',
      city: prev.city || icp.filterHints.city || '',
      state: prev.state || icp.filterHints.state || '',
      ...prev,
    }));
  };

  const handleExecute = () => {
    // Validação específica do tipo "event": URL precisa estar saneada
    if (playbookType === 'event') {
      const { url, error } = sanitizeEventUrl(inputPayload.event_url || '');
      if (!url) {
        toast.error(error || 'URL inválida');
        return;
      }
      // Persiste o valor sanitizado no payload antes de enviar
      const sanitizedPayload = { ...inputPayload, event_url: url };
      setInputPayload(sanitizedPayload);
      onExecute({
        playbookType,
        icpProfileId: selectedIcpId,
        inputPayload: sanitizedPayload,
        importRules: {
          approvalMode,
          scoreThreshold,
          autoImport,
          autoCreateOpportunity,
          autoAssignOwner,
        },
      });
      return;
    }

    onExecute({
      playbookType,
      icpProfileId: selectedIcpId,
      inputPayload,
      importRules: {
        approvalMode,
        scoreThreshold,
        autoImport,
        autoCreateOpportunity,
        autoAssignOwner,
      },
    });
  };

  const eventUrlValidation = useMemo(() => {
    if (playbookType !== 'event') return null;
    if (!inputPayload.event_url) return null;
    return sanitizeEventUrl(inputPayload.event_url);
  }, [playbookType, inputPayload.event_url]);

  return (
    <div className="space-y-6">
      {/* Search Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SEARCH_TYPES.map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setPlaybookType(type.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-sm ${
                playbookType === type.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium text-center leading-tight">{type.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ICP Block */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Perfil Ideal (ICP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedIcpId || ''} onValueChange={v => setSelectedIcpId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ICP" />
              </SelectTrigger>
              <SelectContent>
                {icps?.map(icp => (
                  <SelectItem key={icp.id} value={icp.id}>{icp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIcp && (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{selectedIcp.segment}</Badge>
                  {selectedIcp.company_size && <Badge variant="outline">{selectedIcp.company_size}</Badge>}
                  {selectedIcp.revenue_band && <Badge variant="outline">{selectedIcp.revenue_band}</Badge>}
                </div>
                {selectedIcp.pain_points?.length > 0 && (
                  <div className="text-muted-foreground">
                    Dores: {selectedIcp.pain_points.slice(0, 3).join(', ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Inputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Parâmetros da Busca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbookType === 'event' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do Evento</Label>
                  <Input
                    placeholder="https://evento.com.br/expositores"
                    value={inputPayload.event_url || ''}
                    onChange={e => updatePayload('event_url', e.target.value)}
                    aria-invalid={!!eventUrlValidation?.error}
                  />
                  {eventUrlValidation?.error ? (
                    <p className="flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle className="h-3 w-3" /> {eventUrlValidation.error}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Cole apenas o link da página de expositores. Espaços e texto extra serão removidos automaticamente.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Evento</Label>
                  <Input placeholder="Ex: VTEX Day 2026" value={inputPayload.event_name || ''} onChange={e => updatePayload('event_name', e.target.value)} />
                </div>
              </>
            )}
            {playbookType === 'geo' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Segmento</Label>
                  <Input placeholder="Ex: SaaS, Varejo" value={inputPayload.segment || ''} onChange={e => updatePayload('segment', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Ex: São Paulo" value={inputPayload.city || ''} onChange={e => updatePayload('city', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Input placeholder="Ex: SP" value={inputPayload.state || ''} onChange={e => updatePayload('state', e.target.value)} />
                </div>
              </>
            )}
            {playbookType === 'directory' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Diretório / Fonte</Label>
                  <Input placeholder="Ex: LinkedIn, Crunchbase" value={inputPayload.directory_source || ''} onChange={e => updatePayload('directory_source', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do Diretório (opcional)</Label>
                  <Input placeholder="https://diretorio.com.br/empresas" value={inputPayload.directory_url || ''} onChange={e => updatePayload('directory_url', e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Se informado, faremos crawl direto na URL</p>
                </div>
              </>
            )}
            {playbookType === 'seed' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa Referência</Label>
                <Input placeholder="Ex: Nome de um cliente top" value={inputPayload.seed_company || ''} onChange={e => updatePayload('seed_company', e.target.value)} />
              </div>
            )}
            {playbookType === 'import' && (
              <ImportListInput
                value={inputPayload.import_list || ''}
                onChange={v => updatePayload('import_list', v)}
              />
            )}
          </CardContent>
        </Card>

        {/* Execution Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configurações de Execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Score mínimo ({scoreThreshold})</Label>
              <Slider
                value={[scoreThreshold]}
                onValueChange={([v]) => setScoreThreshold(v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de Aprovação</Label>
              <Select value={approvalMode} onValueChange={setApprovalMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="auto">Automático (score acima do mínimo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Importar automático?</Label>
              <Switch checked={autoImport} onCheckedChange={setAutoImport} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Criar oportunidades?</Label>
              <Switch checked={autoCreateOpportunity} onCheckedChange={setAutoCreateOpportunity} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Atribuir SDR?</Label>
              <Switch checked={autoAssignOwner} onCheckedChange={setAutoAssignOwner} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execute Button */}
      <Button
        size="lg"
        className="w-full text-base"
        onClick={handleExecute}
        disabled={isExecuting}
      >
        {isExecuting ? (
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-5 w-5 mr-2" />
        )}
        {isExecuting ? 'Buscando leads...' : 'Buscar Leads'}
      </Button>
    </div>
  );
}

function ImportListInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lineStats = useMemo(() => {
    const lines = value.split('\n');
    const total = lines.length;
    const valid = lines.filter(l => l.trim().length > 0).length;
    const seen = new Set<string>();
    let dupes = 0;
    for (const l of lines) {
      const key = l.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key) continue;
      if (seen.has(key)) dupes++;
      else seen.add(key);
    }
    return { total, valid, unique: valid - dupes, dupes };
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Nomes das Empresas (uma por linha)</Label>
      <Textarea
        className="min-h-[120px] font-mono text-xs"
        placeholder={"Empresa A\nEmpresa B\nEmpresa C"}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value.trim().length > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{lineStats.valid} empresas válidas</span>
          {lineStats.dupes > 0 && (
            <span className="text-amber-600">{lineStats.dupes} duplicadas</span>
          )}
          <span>{lineStats.unique} únicas</span>
        </div>
      )}
    </div>
  );
}
