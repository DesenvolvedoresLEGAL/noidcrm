// Compute a deterministic signature of an opportunity's "AI-relevant" state.
// Used to cache AI suggestions and only regenerate when context actually changes.

export interface OpportunitySignatureResult {
  signature: string;
  snapshot: Record<string, unknown>;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bucketHour(ts: string | null | undefined): string | null {
  if (!ts) return null;
  // Round to the hour to avoid invalidating cache on every micro-update.
  return String(ts).slice(0, 13); // YYYY-MM-DDTHH
}

export async function computeOpportunitySignature(
  supabase: any,
  opportunityId: string,
): Promise<OpportunitySignatureResult> {
  const { data: opp } = await supabase
    .from('opportunities')
    .select(
      'stage_id, prob, temperature, temperatura, valor_previsto, close_date_prevista, score, updated_at',
    )
    .eq('id', opportunityId)
    .single();

  const [
    { data: lastActivity },
    { data: lastEmail },
    { data: lastNote },
    { data: activeProposal },
    { count: gapsCount },
  ] = await Promise.all([
    supabase
      .from('activities')
      .select('updated_at')
      .eq('opportunity_id', opportunityId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('opportunity_emails')
      .select('created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('opportunity_notes')
      .select('updated_at')
      .eq('opportunity_id', opportunityId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('proposals')
      .select('id, status, expires_at')
      .eq('opportunity_id', opportunityId)
      .in('status', ['draft', 'sent', 'viewed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    Promise.resolve({ count: 0 }),
  ]);

  const snapshot = {
    stage_id: opp?.stage_id ?? null,
    prob: opp?.prob ?? null,
    temperature: (opp?.temperature ?? opp?.temperatura ?? null) || null,
    valor_previsto: opp?.valor_previsto ?? null,
    close_date_prevista: opp?.close_date_prevista ?? null,
    score: opp?.score ?? null,
    last_activity_at: bucketHour(lastActivity?.updated_at),
    last_email_at: bucketHour(lastEmail?.created_at),
    last_note_at: bucketHour(lastNote?.updated_at),
    active_proposal_id: activeProposal?.id ?? null,
    active_proposal_status: activeProposal?.status ?? null,
    active_proposal_expires_at: activeProposal?.expires_at
      ? String(activeProposal.expires_at).slice(0, 10)
      : null,
    gaps_count: gapsCount ?? 0,
  };

  // Stable JSON: keys are inserted in fixed order above.
  const signature = (await sha256Hex(JSON.stringify(snapshot))).slice(0, 16);

  return { signature, snapshot };
}
