// NSEC-1.2-CHG-023 — Canary runner for opportunity account/contact same-tenant compatibility.
// Uses service role ONLY to mint JWTs for synthetic users (allow-list). All probes are executed
// through PostgREST as the synthetic user using their real access_token. TEMPORARY — remove
// together with the RPC after sprint closure.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-nsec12-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_DOMAIN = "example.com";
const EMAIL_PREFIX = "sec-test";
const ALLOWED_EMAILS = new Set([
  "sec-test-a-owner@example.com",
  "sec-test-b-owner@example.com",
  "sec-test-a-viewer@example.com",
  "sec-test-b-viewer@example.com",
]);

const FIX = {
  orgA: "e1c4881f-0cd4-45fb-bc50-48314ce7bca0",
  orgB: "bea090a6-4c6c-45b1-92e0-83678c687578",
  pipeA: "d1f1c882-6769-49d6-a9ca-9de75aeb30f5",
  pipeB: "0526054f-d41d-485c-b669-6f6235b6f992",
  stageA: "18208f58-29b3-4e34-99bb-613751659bc7",
  stageB: "7efae798-823e-4521-a9bc-959ba1551e48",
  accABase: "36085a30-06a1-491a-a079-a24fb42dd92b",
  accAAlt: "14127c66-7d33-43e5-8da4-f960469261af",
  accBBase: "b777baac-072a-4c1a-b481-306d0c899f41",
  accBAlt: "95585017-2d71-4cb2-a145-5ce5f08ada5e",
  contactABase: "55d589fb-e680-455a-b9d9-987a7c2bbbf0",
  contactAAlt: "b1ab7611-d0eb-4cc1-ae9c-2b00adb3d089",
  contactBBase: "47ad14f0-3e17-4a6e-a268-bdd9f5dc8a27",
  contactBAlt: "edfd34a3-2188-4767-80de-de3991c3e0e3",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Guardrail: this function is single-use for CHG-023. Whitelist below limits blast radius
  // to 4 synthetic users. Function will be dropped right after the canary run.


  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, srv, { auth: { persistSession: false } });

  // Mint tokens for the 4 whitelisted synthetic users
  const tokens: Record<string, string> = {};
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const email of ALLOWED_EMAILS) {
    if (!email.startsWith(`${EMAIL_PREFIX}-`) || !email.endsWith(`@${EMAIL_DOMAIN}`)) {
      return json({ error: "email guard breached", email }, 500);
    }
    const u = list?.users?.find((x) => x.email === email);
    if (!u) return json({ error: "user not found", email }, 404);
    const password = "SEC_TEST_" + crypto.randomUUID();
    const { error: uerr } = await admin.auth.admin.updateUserById(u.id, { password });
    if (uerr) return json({ error: "pw reset failed", email, detail: uerr.message }, 500);
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon },
      body: JSON.stringify({ email, password }),
    });
    const tk = await r.json();
    if (!r.ok || !tk.access_token) return json({ error: "signin failed", email, detail: tk }, 500);
    tokens[email] = tk.access_token as string;
  }

  async function probe(
    label: string,
    email: string,
    args: {
      p_organization_id: string;
      p_pipeline_id: string;
      p_stage_id: string;
      p_account_id: string;
      p_contact_id: string;
      p_title: string;
    },
  ) {
    const jwt = tokens[email];
    const res = await fetch(
      `${url}/rest/v1/rpc/nsec12_probe_insert_opportunity_account_contact_match`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(args),
      },
    );
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    return { probe: label, email, http: res.status, result: parsed };
  }

  const T = (n: number) => `SECURITY_TEST_OPPORTUNITY_MATCH_CANARY_P${n}`;
  const results: unknown[] = [];

  // BLOCK 1 — correct pairs
  results.push(await probe("P1", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accABase, p_contact_id: FIX.contactABase, p_title: T(1) }));
  results.push(await probe("P2", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accAAlt,  p_contact_id: FIX.contactAAlt,  p_title: T(2) }));
  results.push(await probe("P3", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBBase, p_contact_id: FIX.contactBBase, p_title: T(3) }));
  results.push(await probe("P4", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBAlt,  p_contact_id: FIX.contactBAlt,  p_title: T(4) }));

  // BLOCK 2 — mismatched same-tenant pairs
  results.push(await probe("P5", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accABase, p_contact_id: FIX.contactAAlt,  p_title: T(5) }));
  results.push(await probe("P6", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accAAlt,  p_contact_id: FIX.contactABase, p_title: T(6) }));
  results.push(await probe("P7", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBBase, p_contact_id: FIX.contactBAlt,  p_title: T(7) }));
  results.push(await probe("P8", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBAlt,  p_contact_id: FIX.contactBBase, p_title: T(8) }));

  // BLOCK 3 — viewer regression
  results.push(await probe("P9",  "sec-test-a-viewer@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accABase, p_contact_id: FIX.contactABase, p_title: T(9)  }));
  results.push(await probe("P10", "sec-test-b-viewer@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBBase, p_contact_id: FIX.contactBBase, p_title: T(10) }));

  // BLOCK 4 — account cross-tenant
  results.push(await probe("P11", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accBBase, p_contact_id: FIX.contactABase, p_title: T(11) }));
  results.push(await probe("P12", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accABase, p_contact_id: FIX.contactBBase, p_title: T(12) }));

  // BLOCK 5 — contact cross-tenant
  results.push(await probe("P13", "sec-test-a-owner@example.com", { p_organization_id: FIX.orgA, p_pipeline_id: FIX.pipeA, p_stage_id: FIX.stageA, p_account_id: FIX.accABase, p_contact_id: FIX.contactBBase, p_title: T(13) }));
  results.push(await probe("P14", "sec-test-b-owner@example.com", { p_organization_id: FIX.orgB, p_pipeline_id: FIX.pipeB, p_stage_id: FIX.stageB, p_account_id: FIX.accBBase, p_contact_id: FIX.contactABase, p_title: T(14) }));

  return json({ probes: results });
});
