import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { MCPJsonEditor } from '../MCPJsonEditor';
import { MCPRiskBadge } from '../MCPRiskBadge';
import {
  useCreateSimulatedMcpInvocation,
  useMcpToolsForInvocation,
} from '@/hooks/useMcpRegistry';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agents: AgentLite[];
  users: UserLite[];
}

export function MCPSimulatedInvocationForm({ open, onOpenChange, agents, users }: Props) {
  const { data: tools = [] } = useMcpToolsForInvocation();
  const create = useCreateSimulatedMcpInvocation();

  const [toolId, setToolId] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('none');
  const [userId, setUserId] = useState<string>('current');
  const [inputValue, setInputValue] = useState<unknown>({});
  const [jsonValid, setJsonValid] = useState(true);

  useEffect(() => {
    if (!open) {
      setToolId('');
      setAgentId('none');
      setUserId('current');
      setInputValue({});
      setJsonValid(true);
    }
  }, [open]);

  const selectedTool = useMemo(() => tools.find((t) => t.id === toolId), [tools, toolId]);
  const showUserSelect = users.length > 0;

  const handleSubmit = async () => {
    if (!toolId) {
      toast.error('Tool obrigatória para criar simulação.');
      return;
    }
    if (!jsonValid) {
      toast.error('JSON inválido. Corrija antes de continuar.');
      return;
    }

    const parsed: Record<string, unknown> =
      inputValue && typeof inputValue === 'object' && !Array.isArray(inputValue)
        ? (inputValue as Record<string, unknown>)
        : {};

    try {
      const res = await create.mutateAsync({
        toolId,
        agentId: agentId !== 'none' ? agentId : null,
        userId: userId !== 'current' ? userId : null,
        inputJson: parsed,
      });

      if (res.execution_status === 'success') {
        toast.success('Simulação registrada com sucesso. Nenhuma ação externa foi executada.');
        onOpenChange(false);
      } else if (res.execution_status === 'blocked') {
        toast.warning(
          `Simulação bloqueada corretamente pela camada MCP.${res.error_message ? ` Motivo: ${res.error_message}` : ''}`,
        );
        onOpenChange(false);
      } else {
        toast.error(res.error_message ?? 'Não foi possível registrar a simulação MCP.');
      }
    } catch (e) {
      const msg = (e as Error).message ?? 'Não foi possível registrar a simulação MCP.';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Criar invocation simulada
          </DialogTitle>
          <DialogDescription>
            A simulação registra a chamada MCP via RPC <code>mcp_record_invocation</code>. Nenhuma
            ação externa é executada e nenhum dado real do CRM é alterado.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Para obter uma simulação <strong>success</strong>, ative MCP em Settings, habilite uma
            tool e crie uma permissão compatível na aba Permissions. Mesmo em success, nenhuma ação
            externa será executada.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Tool *</Label>
            <Select value={toolId} onValueChange={setToolId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tool" />
              </SelectTrigger>
              <SelectContent>
                {tools.length === 0 ? (
                  <SelectItem value="empty" disabled>Nenhuma tool disponível</SelectItem>
                ) : (
                  tools.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">({t.slug})</span>
                        {!t.is_enabled && <span className="text-xs text-amber-700">[disabled]</span>}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedTool && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                <MCPRiskBadge risk={selectedTool.risk_level} />
                <span className="text-muted-foreground">Modo: {selectedTool.execution_mode}</span>
                <span className="text-muted-foreground">
                  {selectedTool.is_enabled ? 'Habilitada' : 'Desabilitada (esperado: blocked)'}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Agent (opcional)</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showUserSelect && (
              <div className="space-y-1">
                <Label>Usuário (opcional)</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Usuário atual (recomendado)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name ?? u.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Input JSON</Label>
            <MCPJsonEditor
              value={inputValue}
              onChange={(v, valid) => {
                setInputValue(v);
                setJsonValid(valid);
              }}
              rows={8}
              helperText="Se vazio, será enviado {} para a RPC."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!toolId || !jsonValid || create.isPending} className="gap-2">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar simulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
