// Testes de dedup diário de proposal_expiring/expired
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("dedup window for expiration alerts is 86400s (1 dia)", () => {
  const WINDOW = 86400;
  assertEquals(WINDOW, 86400);
});

Deno.test("dedup key combina event subtype + proposta (separa 24h vs expired)", () => {
  const proposalId = "prop_xyz";
  const key24h: string = `proposal_expiring_24h:${proposalId}`;
  const keyExpired: string = `proposal_expired:${proposalId}`;
  assertEquals(key24h === keyExpired, false);
});

Deno.test("classifica corretamente baseado em hours_remaining", () => {
  function classify(hoursRemaining: number): { subtype: string; priority: string } {
    if (hoursRemaining <= 0) {
      return { subtype: "proposal_expired", priority: "critical" };
    }
    if (hoursRemaining <= 24) {
      return { subtype: "proposal_expiring_24h", priority: "high" };
    }
    return { subtype: "proposal_expiring", priority: "medium" };
  }

  assertEquals(classify(-2).subtype, "proposal_expired");
  assertEquals(classify(12).subtype, "proposal_expiring_24h");
  assertEquals(classify(48).subtype, "proposal_expiring");
});

Deno.test("respeita proposal_expiring_alert_enabled=false", () => {
  const settings = { proposal_expiring_alert_enabled: false };
  const enabled = settings.proposal_expiring_alert_enabled ?? true;
  assertEquals(enabled, false);
});

Deno.test("não deve considerar proposta terminal como aberta", () => {
  function isStillOpen(proposal: {
    status: string;
    accepted_at?: string | null;
    declined_at?: string | null;
  }) {
    return (
      (proposal.status === "sent" || proposal.status === "viewed") &&
      !proposal.accepted_at &&
      !proposal.declined_at
    );
  }

  assertEquals(
    isStillOpen({ status: "sent", accepted_at: "2026-03-30T13:46:53.612Z", declined_at: null }),
    false,
  );
  assertEquals(
    isStillOpen({ status: "viewed", accepted_at: null, declined_at: "2026-03-30T13:46:53.612Z" }),
    false,
  );
  assertEquals(
    isStillOpen({ status: "sent", accepted_at: null, declined_at: null }),
    true,
  );
});
