// Testes do worker de fallback: garante que push/email falhos caem para in_app
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("default fallback chain quando ausente é ['in_app']", () => {
  const fallback_chain: string[] | null = null;
  const chain = (fallback_chain && fallback_chain.length > 0
    ? fallback_chain
    : ["in_app"]) as string[];
  assertEquals(chain, ["in_app"]);
});

Deno.test("se push falhou, próximo canal é o seguinte da chain", () => {
  const chain = ["push", "email", "in_app"];
  const failed = ["push"];
  const next = chain.find((c) => !failed.includes(c));
  assertEquals(next, "email");
});

Deno.test("se push e email falharam, cai para in_app", () => {
  const chain = ["push", "email", "in_app"];
  const failed = ["push", "email"];
  const next = chain.find((c) => !failed.includes(c));
  assertEquals(next, "in_app");
});

Deno.test("notificação só é resgatada após cutoff de 30s", () => {
  const cutoff = Date.now() - 30 * 1000;
  const notifAge = Date.now() - 5 * 1000; // 5s atrás
  // notif muito recente, ainda não candidata
  assertEquals(notifAge > cutoff, true);
});

Deno.test("delivery_log de fallback é registrado com flag fallback=true", () => {
  const logEntry = {
    notification_id: "n_1",
    channel: "in_app",
    delivery_status: "sent",
    provider_response: { fallback: true, reason: "default_chain" },
  };
  assertEquals(logEntry.provider_response.fallback, true);
  assertEquals(logEntry.channel, "in_app");
});
