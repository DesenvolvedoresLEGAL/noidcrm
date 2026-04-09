import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Rocket, Search, MapPin, Globe, Users, FileUp, CalendarDays, Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listICPs, type ICP } from '@/services/roleplay/icps';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

const SEARCH_TYPES = [
  { id: 'event', label: 'Evento (Expositores)', icon: CalendarDays, description: 'Encontre leads a partir de eventos e feiras' },
  { id: 'directory', label: 'Diretórios', icon: Globe, description: 'Busque em diretórios de empresas' },
  { id: 'geo', label: 'Busca Geográfica', icon: MapPin, description: 'Prospecção por localização' },
  { id: 'seed', label: 'Seed Expansion', icon: Users, description: 'Encontre empresas similares' },
  { id: 'import', label: 'Lista Importada', icon: FileUp, description: 'Analise uma lista existente' },
];

interface LeadSearchFormProps {
  onExecute: (params: { search_type: string; icp_id: string | null; config: Record<string, any> }) => void;
  isExecuting: boolean;
}

export function LeadSearchForm({ onExecute, isExecuting }: LeadSearchFormProps) {
  const { organization } = useCurrentOrganization();
  const [searchType, setSearchType] = useState('geo');
  const [selectedIcpId, setSelectedIcpId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({
    min_score: 60,
    auto_import: false,
    create_opportunities: false,
    assign_sdr: false,
  });

  const { data: icps } = useQuery({
    queryKey: ['icps', organization?.id],
    queryFn: () => listICPs(organization!.id),
    enabled: !!organization?.id,
  });

  const selectedIcp = icps?.find(i => i.id === selectedIcpId);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
    onExecute({ search_type: searchType, icp_id: selectedIcpId, config });
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
              onClick={() => setSearchType(type.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-sm ${
                searchType === type.id
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
            {searchType === 'event' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do Evento</Label>
                  <Input placeholder="https://evento.com.br/expositores" value={config.event_url || ''} onChange={e => updateConfig('event_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Evento</Label>
                  <Input placeholder="Ex: VTEX Day 2026" value={config.event_name || ''} onChange={e => updateConfig('event_name', e.target.value)} />
                </div>
              </>
            )}
            {searchType === 'geo' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Segmento</Label>
                  <Input placeholder="Ex: SaaS, Varejo" value={config.segment || ''} onChange={e => updateConfig('segment', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Ex: São Paulo" value={config.city || ''} onChange={e => updateConfig('city', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Input placeholder="Ex: SP" value={config.state || ''} onChange={e => updateConfig('state', e.target.value)} />
                </div>
              </>
            )}
            {searchType === 'directory' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Diretório / Fonte</Label>
                <Input placeholder="Ex: LinkedIn, Crunchbase" value={config.directory_source || ''} onChange={e => updateConfig('directory_source', e.target.value)} />
              </div>
            )}
            {searchType === 'seed' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa Referência</Label>
                <Input placeholder="Ex: Nome de um cliente top" value={config.seed_company || ''} onChange={e => updateConfig('seed_company', e.target.value)} />
              </div>
            )}
            {searchType === 'import' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nomes das Empresas (uma por linha)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px]"
                  placeholder="Empresa A&#10;Empresa B&#10;Empresa C"
                  value={config.import_list || ''}
                  onChange={e => updateConfig('import_list', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Score mínimo ({config.min_score})</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={config.min_score}
                onChange={e => updateConfig('min_score', Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Importar automático?</Label>
              <Switch checked={config.auto_import} onCheckedChange={v => updateConfig('auto_import', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Criar oportunidades?</Label>
              <Switch checked={config.create_opportunities} onCheckedChange={v => updateConfig('create_opportunities', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Atribuir SDR?</Label>
              <Switch checked={config.assign_sdr} onCheckedChange={v => updateConfig('assign_sdr', v)} />
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
