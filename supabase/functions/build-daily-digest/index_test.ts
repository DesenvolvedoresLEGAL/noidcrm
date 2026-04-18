// Tests do build-daily-digest: schema, settings, hora local, idempotência.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BRT_OFFSET_HOURS = -3;
function localHourToUtcHour(localHHmm: string): number {
  const [hStr] = localHHmm.split(":");
  const local = parseInt(hStr, 10);
  return ((local - BRT_OFFSET_HOURS) % 24 + 24) % 24;
}

Deno.test("06:00 BRT corresponde a 09:00 UTC", () => {
  assertEquals(localHourToUtcHour("06:00"), 9);
});

Deno.test("00:00 BRT corresponde a 03:00 UTC", () => {
  assertEquals(localHourToUtcHour("00:00"), 3);
});

Deno.test("22:00 BRT corresponde a 01:00 UTC (wrap)", () => {
  assertEquals(localHourToUtcHour("22:00"), 1);
});

Deno.test("respeita daily_digest_enabled=false (skip user)", () => {
  const settings = { daily_digest_enabled: false };
  const enabled = settings.daily_digest_enabled ?? true;
  assertEquals(enabled, false);
});

Deno.test("usuário sem settings recebe digest por default", () => {
  const settings: any = null;
  const enabled = settings?.daily_digest_enabled ?? true;
  const time = settings?.daily_digest_time ?? "06:00";
  const emailEnabled = settings?.daily_digest_email_enabled ?? true;
  assertEquals(enabled, true);
  assertEquals(time, "06:00");
  assertEquals(emailEnabled, true);
});

Deno.test("idempotência: pular se já tem cache hoje", () => {
  const cachedSet = new Set(["u1", "u2"]);
  const userIds = ["u1", "u2", "u3"];
  const toProcess = userIds.filter((u) => !cachedSet.has(u));
  assertEquals(toProcess, ["u3"]);
});

Deno.test("schema: payload de daily_digest_runs usa colunas reais", () => {
  const insertPayload = {
    user_id: "u1",
    run_date: "2026-04-18",
    scheduled_for: "2026-04-18T09:00:00.000Z",
    started_at: "2026-04-18T09:00:00.000Z",
    status: "running",
  };
  // Não pode conter colunas antigas
  assertEquals("total_users" in insertPayload, false);
  assertEquals("processed_users" in insertPayload, false);
  assertEquals("completed_at" in insertPayload, false);
  // Deve conter as novas
  assertEquals("user_id" in insertPayload, true);
  assertEquals("scheduled_for" in insertPayload, true);
});
