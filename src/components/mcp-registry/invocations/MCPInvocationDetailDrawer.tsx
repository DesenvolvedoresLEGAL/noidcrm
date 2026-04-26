import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MCPJsonViewer } from '../MCPJsonViewer';
import { MCPInvocationStatusBadge } from '../badges/MCPInvocationStatusBadge';
import { MCPApprovalStatusBadge } from '../badges/MCPApprovalStatusBadge';
import { MCPInvocationTypeBadge } from '../badges/MCPInvocationTypeBadge';
import { MCPRiskBadge } from '../MCPRiskBadge';
import { MCPExecutionModeBadge } from '../MCPExecutionModeBadge';
import type { McpToolInvocation } from '@/services/mcp-registry/types';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  invocation: McpToolInvocation | null;
  agents: AgentLite[];
  users: UserLite[];
  onClose: () => void;
}

function copy(label: string, value: string | null | undefined) {
  if (!value) return;
  navigator.clipboard.writeText(value);
  toast.success(`${label} copiado`);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function MCPInvocationDetailDrawer({ invocation, agents, users, onClose }: Props) {
  const open = !!invocation;
  const r = invocation;
  const agentName = r?.agent_id ? agents.find((a) => a.id === r.agent_id)?.name : null;
  const userName = r?.user_id ? users.find((u) => u.user_id === r.user_id)?.full_name : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Invocation MCP
            {r && <MCPInvocationStatusBadge status={r.execution_status} />}
            {r && <MCPInvocationTypeBadge type={r.invocation_type} />}
          </SheetTitle>
          <SheetDescription>
            Registro técnico somente-leitura. Esta tela não executa ações reais.
          </SheetDescription>
        </SheetHeader>

        {r && (
          <div className="space-y-5 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="ID">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{r.id}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy('ID', r.id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </Field>
              <Field label="Created at">
                {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm:ss')}
              </Field>
              <Field label="Tool">
                <div className="font-medium">{r.tool_slug ?? '—'}</div>
                <div className="font-mono text-xs text-muted-foreground">{r.tool_id ?? '—'}</div>
              </Field>
              <Field label="Risk / Mode">
                <div className="flex flex-wrap gap-1">
                  <MCPRiskBadge risk={r.risk_level} />
                  {r.execution_mode && <MCPExecutionModeBadge mode={r.execution_mode} />}
                </div>
              </Field>
              <Field label="Agent">
                {r.agent_id ? (
                  <div>
                    <div>{agentName ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.agent_id}</div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label="User">
                {r.user_id ? (
                  <div>
                    <div>{userName ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.user_id}</div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label="Approval">
                <MCPApprovalStatusBadge status={r.approval_status} />
                {r.approval_required && <span className="ml-2 text-xs text-muted-foreground">(required)</span>}
              </Field>
              <Field label="Volts consumed">{r.volts_consumed}</Field>
              <Field label="Started at">{r.started_at ? format(new Date(r.started_at), 'dd/MM HH:mm:ss') : '—'}</Field>
              <Field label="Finished at">{r.finished_at ? format(new Date(r.finished_at), 'dd/MM HH:mm:ss') : '—'}</Field>
            </div>

            {r.error_message && (
              <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-sm">
                <div className="text-xs uppercase text-amber-800 dark:text-amber-300 font-medium tracking-wide mb-1">
                  Mensagem
                </div>
                <div className="text-foreground">{r.error_message}</div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Input JSON</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy('Input JSON', JSON.stringify(r.input_json, null, 2))}
                  className="gap-1 h-7"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <MCPJsonViewer value={r.input_json} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Output JSON</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy('Output JSON', JSON.stringify(r.output_json ?? {}, null, 2))}
                  className="gap-1 h-7"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <MCPJsonViewer value={r.output_json ?? {}} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
