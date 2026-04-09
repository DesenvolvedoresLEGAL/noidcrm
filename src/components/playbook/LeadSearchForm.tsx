import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Rocket, MapPin, Globe, Users, FileUp, CalendarDays } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listICPs } from '@/services/roleplay/icps';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { Slider } from '@/components/ui/slider';

const SEARCH_TYPES = [
  { id: 'event', label: 'Evento (Expositores)', icon: CalendarDays, description: 'Encontre leads a partir de eventos e feiras' },
  { id: 'directory', label: 'Diretórios', icon: Globe, description: 'Busque em diretórios de empresas' },
  { id: 'geo', label: 'Busca Geográfica', icon: MapPin, description: 'Prospecção por localização' },
  { id: 'seed', label: 'Seed Expansion', icon: Users, description: 'Encontre empresas similares' },
  { id: 'import', label: 'Lista Importada', icon: FileUp, description: 'Analise uma lista existente' },
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
  const { organization } = useCurrentOrganization();
  const [playbookType, setPlaybookType] = useState('geo');
  const [selectedIcpId, setSelectedIcpId] = useState<string | null>(null);
  const [inputPayload, setInputPayload] = useState<Record<string, any>>({});
  const [scoreThreshold, setScoreThreshold] = useState(60);
  const [approvalMode, setApprovalMode] = useState('manual');
  const [autoImport, setAutoImport] = useState(false);
  const [autoCreateOpportunity, setAutoCreateOpportunity] = useState(false);
  const [autoAssignOwner, setAutoAssignOwner] = useState(false);

  const { data: icps } = useQuery({
    queryKey: ['icps', organization?.id],
    queryFn: () => listICPs(organization!.id),
    enabled: !!organization?.id,
  });

  const selectedIcp = icps?.find(i => i.id === selectedIcpId);

  const updatePayload = (key: string, value: any) => {
    setInputPayload(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
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
                  <Input placeholder="https://evento.com.br/expositores" value={inputPayload.event_url || ''} onChange={e => updatePayload('event_url', e.target.value)} />
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
              <div className="space-y-1.5">
                <Label className="text-xs">Diretório / Fonte</Label>
                <Input placeholder="Ex: LinkedIn, Crunchbase" value={inputPayload.directory_source || ''} onChange={e => updatePayload('directory_source', e.target.value)} />
              </div>
            )}
            {playbookType === 'seed' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa Referência</Label>
                <Input placeholder="Ex: Nome de um cliente top" value={inputPayload.seed_company || ''} onChange={e => updatePayload('seed_company', e.target.value)} />
              </div>
            )}
            {playbookType === 'import' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nomes das Empresas (uma por linha)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px]"
                  placeholder={"Empresa A\nEmpresa B\nEmpresa C"}
                  value={inputPayload.import_list || ''}
                  onChange={e => updatePayload('import_list', e.target.value)}
                />
              </div>
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
        {isExecuting ? 'Executando Caramelo...' : 'Executar Caramelo 🔥'}
      </Button>
    </div>
  );
}
