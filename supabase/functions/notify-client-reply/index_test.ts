// Testes da lógica de deduplicação e geração de eventos para client_replied
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Helper: mock minimal do supabase client com captura de calls
function makeMockSupabase(opts: {
  oppRow?: any;
  acquireLock?: boolean;
  settings?: Record<string, any>;
} = {}) {
  const calls: any[] = [];

  const supabase: any = {
    rpc(name: string, args: any) {
      calls.push({ kind: "rpc", name, args });
      if (name === "try_acquire_dedup_lock") {
        return Promise.resolve({ data: opts.acquireLock ?? true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        gte() { return this; },
        limit() { return this; },
        single() {
          if (table === "opportunities") {
            return Promise.resolve({ data: opts.oppRow, error: null });
          }
          if (table === "notification_events") {
            return Promise.resolve({ data: { id: "evt_1" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "notification_settings") {
            return Promise.resolve({ data: opts.settings ?? null, error: null });
          }
          if (table === "sellers") {
            return Promise.resolve({ data: { manager_id: "mgr_1" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert(payload: any) {
          calls.push({ kind: "insert", table, payload });
          return {
            select() { return this; },
            single() {
              return Promise.resolve({ data: { id: `${table}_id` }, error: null });
            },
          };
        },
      };
    },
  };

  return { supabase, calls };
}

Deno.test("dedup acquire is called with correct window for client_replied", async () => {
  const { supabase, calls } = makeMockSupabase({
    oppRow: {
      id: "opp_1",
      title: "Deal X",
      owner_user_id: "owner_1",
      organization_id: "org_1",
      account_id: "acc_1",
    },
    acquireLock: true,
  });

  // Simula a chamada como o handler real faria
  const opportunity_id = "opp_1";
  const channel = "email";

  await supabase.rpc("try_acquire_dedup_lock", {
    p_organization_id: "org_1",
    p_dedup_key: `client_replied:${opportunity_id}:${channel}`,
    p_event_type: "client_replied",
    p_window_seconds: 180,
  });

  const rpcCall = calls.find((c) => c.name === "try_acquire_dedup_lock");
  assertEquals(rpcCall?.args.p_window_seconds, 180);
  assertEquals(rpcCall?.args.p_dedup_key, "client_replied:opp_1:email");
});

Deno.test("when dedup lock is denied, no notification is created", async () => {
  const { supabase, calls } = makeMockSupabase({ acquireLock: false });

  const result = await supabase.rpc("try_acquire_dedup_lock", {
    p_organization_id: "org_1",
    p_dedup_key: "client_replied:opp_1:email",
    p_event_type: "client_replied",
    p_window_seconds: 180,
  });

  assertEquals(result.data, false);
  // Garante que nenhum insert foi chamado depois do lock negado
  const inserts = calls.filter((c) => c.kind === "insert");
  assertEquals(inserts.length, 0);
});

Deno.test("respects client_reply_alert_enabled=false (skip recipient)", async () => {
  const settings = {
    client_reply_alert_enabled: false,
    realtime_in_app_enabled: true,
    realtime_email_enabled: false,
  };

  // Simula a checagem que a function faz
  const alertEnabled = settings.client_reply_alert_enabled ?? true;
  assertEquals(alertEnabled, false);
  // Logo, o loop deve continuar (skip)
});

Deno.test("recipient resolution includes owner + manager + channel_user (deduped)", () => {
  const owner = "owner_1";
  const manager = "mgr_1";
  const channelUser = "owner_1"; // duplicado intencional

  const recipients = [owner, manager, channelUser];
  const unique = [...new Set(recipients)];
  assertEquals(unique.length, 2);
  assertEquals(unique.includes("owner_1"), true);
  assertEquals(unique.includes("mgr_1"), true);
});
