import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MCPJsonEditor } from '../MCPJsonEditor';
import {
  EXECUTION_MODES,
  RISK_LEVELS,
  type McpExecutionMode,
  type McpRiskLevel,
  type McpServer,
  type McpTool,
} from '@/services/mcp-registry/types';
import type { CreateMcpToolInput } from '@/services/mcp-registry/mcpRegistryService';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: McpTool | null;
  servers: McpServer[];
  onSubmit: (data: CreateMcpToolInput) => Promise<void> | void;
  saving?: boolean;
}

export function MCPToolForm({ open, onOpenChange, initial, servers, onSubmit, saving }: Props) {
  const editing = !!initial;
  const [serverId, setServerId] = useState<string>('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [riskLevel, setRiskLevel] = useState<McpRiskLevel>('low');
  const [executionMode, setExecutionMode] = useState<McpExecutionMode>('read_only');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [inputSchema, setInputSchema] = useState<Record<string, unknown>>({});
  const [outputSchema, setOutputSchema] = useState<Record<string, unknown>>({});
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [inputValid, setInputValid] = useState(true);
  const [outputValid, setOutputValid] = useState(true);
  const [metaValid, setMetaValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    setServerId(initial?.server_id ?? '');
    setName(initial?.name ?? '');
    setSlug(initial?.slug ?? '');
    setDescription(initial?.description ?? '');
    setCategory(initial?.category ?? '');
    setRiskLevel((initial?.risk_level as McpRiskLevel) ?? 'low');
    setExecutionMode((initial?.execution_mode as McpExecutionMode) ?? 'read_only');
    setRequiresApproval(initial?.requires_approval ?? false);
    setIsEnabled(editing ? (initial?.is_enabled ?? false) : false);
    setInputSchema(initial?.input_schema ?? {});
    setOutputSchema(initial?.output_schema ?? {});
    setMetadata(initial?.metadata ?? {});
    setInputValid(true);
    setOutputValid(true);
    setMetaValid(true);
  }, [open, initial, editing]);

  // Auto-set requires_approval para risco alto/crítico ou modo approval_required
  const approvalForced = useMemo(
    () =>
      riskLevel === 'high' ||
      riskLevel === 'critical' ||
      executionMode === 'approval_required',
    [riskLevel, executionMode],
  );

  useEffect(() => {
    if (approvalForced && !requiresApproval) setRequiresApproval(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalForced]);

  const handleSave = async () => {
    if (!serverId) {
      toast.error('Servidor é obrigatório.');
      return;
    }
    if (!name.trim() || !slug.trim()) {
      toast.error('Nome e slug são obrigatórios.');
      return;
    }
    if (!inputValid || !outputValid || !metaValid) {
      toast.error('JSON inválido. Corrija antes de salvar.');
      return;
    }
    await onSubmit({
      server_id: serverId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      risk_level: riskLevel,
      execution_mode: executionMode,
      requires_approval: approvalForced ? true : requiresApproval,
      is_enabled: editing ? isEnabled : false,
      input_schema: inputSchema,
      output_schema: outputSchema,
      metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar tool' : 'Nova tool'}</DialogTitle>
          <DialogDescription>
            Tools novas nascem desabilitadas. Tools de risco alto/crítico exigem aprovação humana.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Servidor *</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger><SelectValue placeholder="Selecione um servidor" /></SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} <span className="text-muted-foreground ml-1">({s.slug})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Slug *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="crm, sales, ..." />
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

          <div className="space-y-1.5">
            <Label>Modo de execução *</Label>
            <Select value={executionMode} onValueChange={(v) => setExecutionMode(v as McpExecutionMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXECUTION_MODES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Requer aprovação</Label>
              <Switch checked={approvalForced ? true : requiresApproval} onCheckedChange={setRequiresApproval} disabled={approvalForced} />
            </div>
            {approvalForced && (
              <p className="text-xs text-muted-foreground">
                Forçado por risco alto/crítico ou modo "approval_required".
              </p>
            )}
          </div>

          {editing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Habilitada</Label>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {executionMode === 'automatic_controlled' && (
            <div className="sm:col-span-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Execução automática controlada ainda não está liberada nesta fase.</span>
            </div>
          )}

          <div className="sm:col-span-2">
            <MCPJsonEditor
              label="Input schema (JSON)"
              value={inputSchema}
              onChange={(parsed, valid) => {
                if (valid) setInputSchema((parsed as Record<string, unknown>) ?? {});
                setInputValid(valid);
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <MCPJsonEditor
              label="Output schema (JSON)"
              value={outputSchema}
              onChange={(parsed, valid) => {
                if (valid) setOutputSchema((parsed as Record<string, unknown>) ?? {});
                setOutputValid(valid);
              }}
            />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !inputValid || !outputValid || !metaValid}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
