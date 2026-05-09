// Sprint A — Headless Humanoid: useAction hook
// Wrapper genérico para registrar + executar ações catalogadas no action_registry.
// Toda chamada gera rastro em action_executions, valida role no servidor e
// respeita aprovação quando aplicável.
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ActionSurface = 'web' | 'slack' | 'whatsapp' | 'email' | 'agent' | 'api';

export interface ActionContext {
  entityType?: string;
  entityId?: string;
  surface?: ActionSurface;
}

export interface RegisterActionResult {
  ok: boolean;
  error?: string;
  execution_id?: string;
  status?: 'pending' | 'awaiting_approval';
  approval_required?: boolean;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  executor_type?: 'edge_function' | 'rpc' | 'service' | 'manual';
  executor_ref?: string;
  required_role?: string;
}

export interface RunActionOptions<TInput> {
  input?: TInput;
  context?: ActionContext;
  /** Função que executa a ação real após registro aprovado. Recebe execution_id. */
  execute: (executionId: string) => Promise<unknown>;
  /** Mensagem de sucesso no toast. */
  successMessage?: string;
  /** Mensagem de erro no toast. */
  errorMessage?: string;
  /** Callback após sucesso. */
  onSuccess?: (output: unknown) => void;
}

async function registerExecution(
  actionKey: string,
  input: unknown,
  ctx?: ActionContext,
): Promise<RegisterActionResult> {
  const { data, error } = await supabase.rpc('register_action_execution', {
    p_action_key: actionKey,
    p_input: (input ?? {}) as never,
    p_entity_type: ctx?.entityType ?? null,
    p_entity_id: ctx?.entityId ?? null,
    p_surface: ctx?.surface ?? 'web',
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: 'no_response' }) as unknown as RegisterActionResult;
}

async function completeExecution(
  executionId: string,
  status: 'succeeded' | 'failed' | 'blocked',
  payload: { output?: unknown; error?: string; durationMs?: number } = {},
) {
  await supabase.rpc('complete_action_execution', {
    p_execution_id: executionId,
    p_status: status,
    p_output: (payload.output ?? null) as never,
    p_after_state: null,
    p_error: payload.error ?? null,
    p_duration_ms: payload.durationMs ?? null,
  });
}

export function useAction(actionKey: string) {
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const run = useCallback(
    async <TInput,>(opts: RunActionOptions<TInput>) => {
      setLoading(true);
      setLastError(null);
      const start = Date.now();
      try {
        const reg = await registerExecution(actionKey, opts.input, opts.context);

        if (!reg.ok) {
          setLastError(reg.error ?? 'unknown');
          toast({
            title: 'Ação bloqueada',
            description: reg.error === 'insufficient_role'
              ? `Esta ação exige o papel "${reg.required_role}".`
              : reg.error === 'action_not_found'
                ? 'Ação não está cadastrada no Action Registry.'
                : (opts.errorMessage ?? `Não foi possível executar (${reg.error}).`),
            variant: 'destructive',
          });
          return { ok: false as const, error: reg.error };
        }

        if (reg.status === 'awaiting_approval') {
          toast({
            title: 'Aprovação solicitada',
            description: 'Esta ação foi enviada para a fila de aprovação.',
          });
          return { ok: true as const, awaitingApproval: true, executionId: reg.execution_id };
        }

        // Executa o trabalho real
        const output = await opts.execute(reg.execution_id!);
        await completeExecution(reg.execution_id!, 'succeeded', {
          output,
          durationMs: Date.now() - start,
        });

        if (opts.successMessage) {
          toast({ title: opts.successMessage });
        }
        opts.onSuccess?.(output);

        return { ok: true as const, output, executionId: reg.execution_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLastError(message);
        toast({
          title: opts.errorMessage ?? 'Falha ao executar',
          description: message,
          variant: 'destructive',
        });
        return { ok: false as const, error: message };
      } finally {
        setLoading(false);
      }
    },
    [actionKey],
  );

  return { run, loading, lastError };
}
