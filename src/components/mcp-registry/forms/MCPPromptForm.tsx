import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MCPJsonEditor } from '../MCPJsonEditor';
import {
  PROMPT_TYPES,
  STATUSES,
  type McpPrompt,
  type McpPromptType,
  type McpStatus,
} from '@/services/mcp-registry/types';
import type { CreateMcpPromptInput } from '@/services/mcp-registry/mcpRegistryService';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: McpPrompt | null;
  onSubmit: (data: CreateMcpPromptInput) => Promise<void> | void;
  saving?: boolean;
}

export function MCPPromptForm({ open, onOpenChange, initial, onSubmit, saving }: Props) {
  const editing = !!initial;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [promptType, setPromptType] = useState<McpPromptType>('template');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState<number>(1);
  const [status, setStatus] = useState<McpStatus>('draft');
  const [variables, setVariables] = useState<unknown[]>([]);
  const [variablesValid, setVariablesValid] = useState(true);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [metaValid, setMetaValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSlug(initial?.slug ?? '');
    setDescription(initial?.description ?? '');
    setPromptType((initial?.prompt_type as McpPromptType) ?? 'template');
    setContent(initial?.content ?? '');
    setVersion(initial?.version ?? 1);
    setStatus(editing ? ((initial?.status as McpStatus) ?? 'draft') : 'draft');
    setVariables(Array.isArray(initial?.variables) ? (initial!.variables as unknown[]) : []);
    setMetadata(initial?.metadata ?? {});
    setVariablesValid(true);
    setMetaValid(true);
  }, [open, initial, editing]);

  const editingActive = editing && initial?.status === 'active';

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return toast.error('Nome e slug são obrigatórios.');
    if (!content.trim()) return toast.error('Conteúdo é obrigatório.');
    if (version < 1) return toast.error('Versão deve ser >= 1.');
    if (!variablesValid || !metaValid) return toast.error('JSON inválido. Corrija antes de salvar.');

    await onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      prompt_type: promptType,
      content,
      variables,
      version,
      status: editing ? status : 'draft',
      metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar prompt' : 'Novo prompt'}</DialogTitle>
          <DialogDescription>
            Prompts novos nascem em rascunho. Promova para "active" somente após revisão.
          </DialogDescription>
        </DialogHeader>

        {editingActive && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Você está editando um prompt ativo. Para ambientes produtivos, recomendamos criar uma nova versão.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={promptType} onValueChange={(v) => setPromptType(v as McpPromptType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROMPT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Versão *</Label>
            <Input type="number" min={1} value={version} onChange={(e) => setVersion(Number(e.target.value) || 1)} />
          </div>

          {editing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as McpStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Conteúdo *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="font-mono text-xs" />
          </div>

          <div className="sm:col-span-2">
            <MCPJsonEditor
              label="Variables (JSON array)"
              value={variables}
              fallback="array"
              onChange={(parsed, valid) => {
                if (valid && Array.isArray(parsed)) setVariables(parsed);
                setVariablesValid(valid);
              }}
              helperText='Ex: [{"name":"client_name","required":true}]'
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
          <Button onClick={handleSave} disabled={saving || !variablesValid || !metaValid}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
