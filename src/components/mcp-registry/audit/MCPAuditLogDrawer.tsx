import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MCPJsonViewer } from '../MCPJsonViewer';
import { MCPAuditActionBadge } from '../badges/MCPAuditActionBadge';
import { MCPAuditEntityBadge } from '../badges/MCPAuditEntityBadge';
import type { McpAuditLog } from '@/services/mcp-registry/types';
import type { AgentLite, UserLite } from '@/services/mcp-registry/mcpPermissionsService';

interface Props {
  log: McpAuditLog | null;
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

export function MCPAuditLogDrawer({ log, agents, users, onClose }: Props) {
  const open = !!log;
  const r = log;
  const agentName = r?.agent_id ? agents.find((a) => a.id === r.agent_id)?.name : null;
  const userName = r?.user_id ? users.find((u) => u.user_id === r.user_id)?.full_name : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Audit log MCP
            {r && <MCPAuditEntityBadge entityType={r.entity_type} />}
            {r && <MCPAuditActionBadge action={r.action} />}
          </SheetTitle>
          <SheetDescription>Registro técnico somente-leitura.</SheetDescription>
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
              <Field label="Created at">{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm:ss')}</Field>
              <Field label="Entity ID">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{r.entity_id ?? '—'}</span>
                  {r.entity_id && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy('Entity ID', r.entity_id)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Organization ID">
                <span className="font-mono text-xs">{r.organization_id ?? '—'}</span>
              </Field>
              <Field label="User">
                {r.user_id ? (
                  <div>
                    <div>{userName ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.user_id}</div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label="Agent">
                {r.agent_id ? (
                  <div>
                    <div>{agentName ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.agent_id}</div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label="IP">{r.ip_address ?? '—'}</Field>
              <Field label="User agent"><span className="text-xs">{r.user_agent ?? '—'}</span></Field>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Before</div>
                <Button size="sm" variant="ghost" onClick={() => copy('Before', JSON.stringify(r.before_json ?? {}, null, 2))} className="gap-1 h-7">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <MCPJsonViewer value={r.before_json ?? {}} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">After</div>
                <Button size="sm" variant="ghost" onClick={() => copy('After', JSON.stringify(r.after_json ?? {}, null, 2))} className="gap-1 h-7">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <MCPJsonViewer value={r.after_json ?? {}} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Metadata</div>
                <Button size="sm" variant="ghost" onClick={() => copy('Metadata', JSON.stringify(r.metadata ?? {}, null, 2))} className="gap-1 h-7">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <MCPJsonViewer value={r.metadata ?? {}} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
