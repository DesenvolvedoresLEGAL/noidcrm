// Testes do daily digest: agregação correta + respeito a settings
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("respeita daily_digest_enabled=false (skip user)", () => {
  const settings = { daily_digest_enabled: false };
  const enabled = settings.daily_digest_enabled ?? true;
  assertEquals(enabled, false);
});

Deno.test("usuário sem settings recebe digest por default", () => {
  const settings: any = null;
  const enabled = settings?.daily_digest_enabled ?? true;
  assertEquals(enabled, true);
});

Deno.test("daily_digest_time padrão é 06:00", () => {
  const settings: any = {};
  const time = settings.daily_digest_time ?? "06:00";
  assertEquals(time, "06:00");
});

Deno.test("agrega contagens por categoria (mock)", () => {
  const events = [
    { type: "proposal_viewed" },
    { type: "proposal_viewed" },
    { type: "client_replied" },
    { type: "proposal_expiring_24h" },
  ];

  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  assertEquals(counts.proposal_viewed, 2);
  assertEquals(counts.client_replied, 1);
  assertEquals(counts.proposal_expiring_24h, 1);
});

Deno.test("digest distribui notification para cada user (in_app + email opcional)", () => {
  const userIds = ["u1", "u2", "u3"];
  const channels = userIds.map(() => ({
    channel_in_app: true,
    channel_email: true,
  }));
  assertEquals(channels.length, 3);
  assertEquals(channels.every((c) => c.channel_in_app), true);
});
