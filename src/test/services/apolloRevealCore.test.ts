import { describe, expect, it } from "vitest";
// @ts-ignore — módulo Deno compartilhado, testado como TS puro.
import {
  extractProviderCredits,
  extractProviderRequestId,
  isTrackableJob,
} from "../../../supabase/functions/_shared/apollo-reveal-core.ts";

describe("apollo reveal core — KAI.18.15 (sem chamadas pagas)", () => {
  it("extrai request_id 64-bit sem perda de precisão", () => {
    const raw = '{"person":{"id":"abc"},"request_id":9007199254740993123}';
    expect(extractProviderRequestId(raw, JSON.parse(raw), null)).toBe("9007199254740993123");
  });

  it("extrai request_id negativo e string", () => {
    expect(extractProviderRequestId('{"request_id":-7788991122334455667}', {}, null)).toBe("-7788991122334455667");
    expect(extractProviderRequestId('{"webhook_request_id":"wr_123"}', {}, null)).toBe("wr_123");
  });

  it("usa header como último recurso e retorna null sem sinal", () => {
    expect(extractProviderRequestId(null, {}, "hdr-1")).toBe("hdr-1");
    expect(extractProviderRequestId('{"foo":1}', { foo: 1 }, null)).toBeNull();
  });

  it("nunca infere créditos: só usa valores confirmados", () => {
    expect(extractProviderCredits({ credits_consumed: 1 })).toBe(1);
    expect(extractProviderCredits({ credits_used: "2" })).toBe(2);
    expect(extractProviderCredits({ credits_consumed: 0 })).toBe(0);
    expect(extractProviderCredits({})).toBeNull();
    expect(extractProviderCredits(null)).toBeNull();
  });

  it("job só é reaproveitável se for rastreável, vivo e não terminal", () => {
    const now = Date.now();
    const fresh = new Date(now - 30_000).toISOString();
    const old = new Date(now - 10 * 60_000).toISOString();
    const future = new Date(now + 3600_000).toISOString();
    const past = new Date(now - 3600_000).toISOString();

    // zumbi: sem request_id e antigo
    expect(isTrackableJob({ status: "pending_provider", created_at: old, provider_request_id: null, expires_at: future }, now).trackable).toBe(false);
    // recém-criado sem request_id ainda é aceitável (janela de 2 min)
    expect(isTrackableJob({ status: "running", created_at: fresh, provider_request_id: null, expires_at: future }, now).trackable).toBe(true);
    // com request_id e válido
    expect(isTrackableJob({ status: "pending_provider", created_at: old, provider_request_id: "123", expires_at: future }, now).trackable).toBe(true);
    // expirado
    expect(isTrackableJob({ status: "pending_provider", created_at: old, provider_request_id: "123", expires_at: past }, now).trackable).toBe(false);
    // terminal
    expect(isTrackableJob({ status: "done", created_at: fresh, provider_request_id: "123", expires_at: future }, now).trackable).toBe(false);
  });
});
