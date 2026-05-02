export type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type OpenAITransportOptions = {
  model: string;
  messages: OpenAIMessage[];
  max_completion_tokens: number;
  response_format?: { type: 'json_object' | 'text' };
  timeoutMs?: number;
  maxRetries?: number;
};

export type OpenAITransportResult = {
  data: any;
  content: string;
  usage?: Usage;
  metadata: {
    model: string;
    retryCount: number;
    attempts: number;
    timedOut: boolean;
    durationMs: number;
  };
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const msg = err.message.toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('aborted');
}

function safeDigest(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function callOpenAIWithGuardrails(opts: OpenAITransportOptions): Promise<OpenAITransportResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('[openai-client] Missing OPENAI_API_KEY/LOVABLE_API_KEY');

  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxRetries = opts.maxRetries ?? 2;
  const started = Date.now();

  let attempts = 0;
  let timedOut = false;
  let lastError: Error | null = null;

  while (attempts <= maxRetries) {
    attempts++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          max_completion_tokens: opts.max_completion_tokens,
          ...(opts.response_format ? { response_format: opts.response_format } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errBody = await resp.text();
        const summary = `[openai-client] status=${resp.status} body_len=${errBody.length} body_hash=${safeDigest(errBody)}`;
        if (isRetryableStatus(resp.status) && attempts <= maxRetries) {
          await new Promise((r) => setTimeout(r, Math.min(1200, 250 * 2 ** (attempts - 1)) + Math.floor(Math.random() * 120)));
          continue;
        }
        throw new Error(summary);
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      return {
        data,
        content,
        usage: data?.usage,
        metadata: {
          model: opts.model,
          retryCount: Math.max(0, attempts - 1),
          attempts,
          timedOut,
          durationMs: Date.now() - started,
        },
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (isRetryableError(err) && attempts <= maxRetries) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, Math.min(1200, 250 * 2 ** (attempts - 1)) + Math.floor(Math.random() * 120)));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`[openai-client] retry exhausted attempts=${attempts} timedOut=${timedOut} lastError=${lastError?.message ?? 'unknown'}`);
}
