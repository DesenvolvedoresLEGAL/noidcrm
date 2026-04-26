import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MCPJsonEditor } from '../MCPJsonEditor';
import {
  READ_SCOPES,
  RESOURCE_TYPES,
  RISK_LEVELS,
  type McpReadScope,
  type McpResource,
  type McpResourceType,
  type McpRiskLevel,
  type McpServer,
} from '@/services/mcp-registry/types';
import type { CreateMcpResourceInput } from '@/services/mcp-registry/mcpRegistryService';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: McpResource | null;
  servers: McpServer[];
  onSubmit: (data: CreateMcpResourceInput) => Promise<void> | void;
  saving?: boolean;
}

export function MCPResourceForm({ open, onOpenChange, initial, servers, onSubmit, saving }: Props) {
  const editing = !!initial;
  const [serverId, setServerId] = useState<string>('');
  const [name, setName] = useState('');
  const [uriPattern, setUriPattern] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState<McpResourceType>('crm');
  const [readScope, setReadScope] = useState<McpReadScope>('tenant');
  const [riskLevel, setRiskLevel] = useState<McpRiskLevel>('low');
  const [isEnabled, setIsEnabled] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [metaValid, setMetaValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    setServerId(initial?.server_id ?? '');
    setName(initial?.name ?? '');
    setUriPattern(initial?.uri_pattern ?? '');
    setDescription(initial?.description ?? '');
    setResourceType((initial?.resource_type as McpResourceType) ?? 'crm');
    setReadScope((initial?.read_scope as McpReadScope) ?? 'tenant');
    setRiskLevel((initial?.risk_level as McpRiskLevel) ?? 'low');
    setIsEnabled(editing ? (initial?.is_enabled ?? false) : false);
    setMetadata(initial?.metadata ?? {});
    setMetaValid(true);
  }, [open, initial, editing]);

  const showAdminOnlyHint = readScope === 'admin_only' && riskLevel === 'low';

  const handleSave = async () => {
    if (!serverId) return toast.error('Servidor é obrigatório.');
    if (!name.trim() || !uriPattern.trim()) return toast.error('Nome e URI Pattern são obrigatórios.');
    if (!metaValid) return toast.error('JSON inválido. Corrija antes de salvar.');

    await onSubmit({
      server_id: serverId,
      name: name.trim(),
      uri_pattern: uriPattern.trim(),
      description: description.trim() || null,
      resource_type: resourceType,
      read_scope: readScope,
      risk_level: riskLevel,
      is_enabled: editing ? isEnabled : false,
      metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar resource' : 'Novo resource'}</DialogTitle>
          <DialogDescription>
            Resources definem fontes de contexto que agentes podem ler. Resources novos nascem desabilitados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Servidor *</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger><SelectValue placeholder="Selecione um servidor" /></SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>URI Pattern *</Label>
            <Input value={uriPattern} onChange={(e) => setUriPattern(e.target.value)} placeholder="crm://accounts/{id}" />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={resourceType} onValueChange={(v) => setResourceType(v as McpResourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Escopo de leitura *</Label>
            <Select value={readScope} onValueChange={(v) => setReadScope(v as McpReadScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {READ_SCOPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Risco *</Label>
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as McpRiskLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {editing && (
            <div className="space-y-1.5 flex items-end justify-between">
              <Label>Habilitado</Label>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {showAdminOnlyHint && (
            <div className="sm:col-span-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md">
              Resources com escopo <strong>admin_only</strong> geralmente devem ter risco alto ou superior.
            </div>
          )}

          {resourceType === 'external' && (
            <div className="sm:col-span-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Resources externos ainda não devem ser usados em produção nesta fase.</span>
            </div>
          )}

          <div className="sm:col-span-2">
            <MCPJsonEditor
              label="Metadata (JSON)"
              value={metadata}
              onChange={(parsed, valid) => {
                if (valid) setMetadata((parsed as Record<string, unknown>) ?? {});
                setMetaValid(valid);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !metaValid}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
