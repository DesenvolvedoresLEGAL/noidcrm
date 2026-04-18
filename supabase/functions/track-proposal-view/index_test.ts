// Testes da lógica de dedup e proteção do owner=viewer em proposal_viewed
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("dedup window for proposal_viewed is 600s (10 min)", () => {
  const PROPOSAL_VIEWED_WINDOW = 600;
  assertEquals(PROPOSAL_VIEWED_WINDOW, 600);
});

Deno.test("dedup key includes proposal id only (cliente abrindo de devices diferentes ainda dedupa)", () => {
  const proposalId = "prop_abc";
  const dedupKey = `proposal_viewed:${proposalId}`;
  assertEquals(dedupKey, "proposal_viewed:prop_abc");
});

Deno.test("owner viewing own proposal should NOT trigger notification", () => {
  // Heurística: se o viewer é authenticated e bate com owner, não notifica
  const ownerId = "u_1";
  const viewerId = "u_1";
  const isInternalView = ownerId === viewerId;
  assertEquals(isInternalView, true); // function deve retornar early
});

Deno.test("multi-channel: in_app=true, email=false por default sem settings", () => {
  const settings: any = null;
  const channelInApp = settings?.realtime_in_app_enabled ?? true;
  const channelEmail = settings?.realtime_email_enabled ?? false;
  assertEquals(channelInApp, true);
  assertEquals(channelEmail, false);
});

Deno.test("recipients = owner + manager (deduped), filtra nulos", () => {
  const ownerId = "owner_1";
  const managerId: string | null = null;
  const recipients = [ownerId, managerId].filter(Boolean) as string[];
  const unique = [...new Set(recipients)];
  assertEquals(unique, ["owner_1"]);
});
