import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MCPJsonEditor } from '../MCPJsonEditor';
import {
  AUTH_TYPES,
  RISK_LEVELS,
  SERVER_TYPES,
  STATUSES,
  TRANSPORT_TYPES,
  type McpAuthType,
  type McpRiskLevel,
  type McpServer,
  type McpServerType,
  type McpStatus,
  type McpTransportType,
} from '@/services/mcp-registry/types';
import type { CreateMcpServerInput } from '@/services/mcp-registry/mcpRegistryService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: McpServer | null;
  allowExternalServers: boolean;
  onSubmit: (data: CreateMcpServerInput) => Promise<void> | void;
  saving?: boolean;
}

export function MCPServerForm({ open, onOpenChange, initial, allowExternalServers, onSubmit, saving }: Props) {
  const editing = !!initial;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [serverType, setServerType] = useState<McpServerType>('internal');
  const [transportType, setTransportType] = useState<McpTransportType>('http');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState<McpStatus>('draft');
  const [authType, setAuthType] = useState<McpAuthType>('none');
  const [riskLevel, setRiskLevel] = useState<McpRiskLevel>('low');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [metaValid, setMetaValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSlug(initial?.slug ?? '');
    setDescription(initial?.description ?? '');
    setServerType((initial?.server_type as McpServerType) ?? 'internal');
    setTransportType((initial?.transport_type as McpTransportType) ?? 'http');
    setBaseUrl(initial?.base_url ?? '');
    setStatus((initial?.status as McpStatus) ?? 'draft');
    setAuthType((initial?.auth_type as McpAuthType) ?? 'none');
    setRiskLevel((initial?.risk_level as McpRiskLevel) ?? 'low');
    setMetadata(initial?.metadata ?? {});
    setMetaValid(true);
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error('Nome e slug são obrigatórios.');
      return;
    }
    if (!metaValid) {
      toast.error('JSON inválido. Corrija antes de salvar.');
      return;
    }
    if (serverType === 'external' && status === 'active' && !allowExternalServers) {
      toast.error('Servidores externos estão bloqueados nas configurações MCP desta organização.');
      return;
    }
    await onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      server_type: serverType,
      transport_type: transportType,
      base_url: baseUrl.trim() || null,
      status,
      auth_type: authType,
      risk_level: riskLevel,
      metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar servidor MCP' : 'Novo servidor MCP'}</DialogTitle>
          <DialogDescription>
            Servidores MCP definem onde tools e resources estão hospedados. Mantenha a fundação segura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: NOID Internal MCP" />
          </div>

          <div className="space-y-1.5">
            <Label>Slug *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="noid_internal_mcp" />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={serverType} onValueChange={(v) => setServerType(v as McpServerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Transporte *</Label>
            <Select value={transportType} onValueChange={(v) => setTransportType(v as McpTransportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as McpStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Autenticação *</Label>
            <Select value={authType} onValueChange={(v) => setAuthType(v as McpAuthType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

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

          {serverType === 'external' && !allowExternalServers && (
            <div className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
              Servidores externos estão bloqueados nas configurações desta organização. Você pode salvar este registro
              em <strong>draft</strong>, mas não conseguirá ativá-lo até liberar nas Settings.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !metaValid}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
