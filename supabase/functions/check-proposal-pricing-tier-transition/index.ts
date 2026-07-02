// Notifica o vendedor responsável (e seu manager) sobre a virada da tabela
// de preço dinâmica das propostas: 72h, 48h e 24h antes do tier atual expirar.
//
// Roda em cron horário. Faz dedup por (proposal_id + janela) por 24h para
// nunca duplicar o mesmo aviso, e usa o padrão notification_events +
// notifications_v2 (PRIME) já consumido pelo Inbox unificado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RuleRow {
  id: string;
  proposal_id: string;
  organization_id: string;
  current_amount: number | null;
  next_amount: number | null;
  current_tier_id: string | null;
  next_tier_id: string | null;
  enabled: boolean;
  status: string;
}

interface TierRow {
  id: string;
  ends_at: string | null;
  starts_at: string | null;
  label: string | null;
  final_amount: number;
}

interface ProposalRow {
  id: string;
  proposal_number: string | null;
  title: string | null;
  client_name: string | null;
  status: string;
  accepted_at: string | null;
  declined_at: string | null;
  deleted_at: string | null;
  opportunity_id: string;
  organization_id: string;
}

const BRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v ?? 0),
  );

const formatTransitionDate = (iso: string | null) => {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const horizon = new Date(now.getTime() + 73 * 60 * 60 * 1000); // +73h

    // 1) Pega todas as regras ativas com tier atual definido
    const { data: rules, error: rulesErr } = await supabase
      .from("proposal_dynamic_pricing_rules")
      .select(
        "id, proposal_id, organization_id, current_amount, next_amount, current_tier_id, next_tier_id, enabled, status",
      )
      .eq("enabled", true)
      .eq("status", "active")
      .not("current_tier_id", "is", null);

    if (rulesErr) {
      console.error("[tier-transition] rules error", rulesErr);
      return new Response(JSON.stringify({ error: rulesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "no active rules" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;

    for (const rule of rules as RuleRow[]) {
      if (!rule.current_tier_id) continue;

      // 2) Tier atual (precisa do ends_at = momento da virada)
      const { data: currentTier } = await supabase
        .from("proposal_dynamic_pricing_tiers")
        .select("id, ends_at, starts_at, label, final_amount")
        .eq("id", rule.current_tier_id)
        .maybeSingle() as { data: TierRow | null };

      if (!currentTier?.ends_at) continue;
      const transitionAt = new Date(currentTier.ends_at);
      if (transitionAt <= now || transitionAt > horizon) continue;

      const hoursRemaining = Math.ceil(
        (transitionAt.getTime() - now.getTime()) / (1000 * 60 * 60),
      );

      // Janela: 72h (entre 49 e 72), 48h (entre 25 e 48), 24h (entre 1 e 24)
      let windowKey: "72h" | "48h" | "24h" | null = null;
      if (hoursRemaining > 48 && hoursRemaining <= 72) windowKey = "72h";
      else if (hoursRemaining > 24 && hoursRemaining <= 48) windowKey = "48h";
      else if (hoursRemaining >= 1 && hoursRemaining <= 24) windowKey = "24h";
      if (!windowKey) continue;

      // 3) Proposta ainda aberta?
      const { data: proposal } = await supabase
        .from("proposals")
        .select(
          "id, proposal_number, title, client_name, status, accepted_at, declined_at, deleted_at, opportunity_id, organization_id",
        )
        .eq("id", rule.proposal_id)
        .maybeSingle() as { data: ProposalRow | null };

      if (!proposal) continue;
      if (proposal.deleted_at) continue;
      if (proposal.accepted_at || proposal.declined_at) continue;
      if (!["draft", "sent", "viewed"].includes(proposal.status)) continue;
      if (!proposal.opportunity_id) continue;

      // 4) Próximo tier (para mostrar próximo valor)
      let nextTier: TierRow | null = null;
      if (rule.next_tier_id) {
        const { data: nt } = await supabase
          .from("proposal_dynamic_pricing_tiers")
          .select("id, ends_at, starts_at, label, final_amount")
          .eq("id", rule.next_tier_id)
          .maybeSingle();
        nextTier = (nt as TierRow | null) ?? null;
      }

      const eventSubtype = `proposal_pricing_tier_transition_${windowKey}`;
      const dedupKey = `${eventSubtype}:${proposal.id}:${currentTier.id}`;

      const { data: lockAcquired } = await supabase.rpc(
        "try_acquire_dedup_lock",
        {
          p_organization_id: proposal.organization_id,
          p_dedup_key: dedupKey,
          p_event_type: eventSubtype,
          p_window_seconds: 86400,
        },
      );

      if (!lockAcquired) {
        console.log(`[tier-transition] [dedup] skipped ${dedupKey}`);
        continue;
      }

      const proposalLabel =
        proposal.proposal_number || proposal.title || proposal.id.slice(0, 8);
      const companyName = proposal.client_name || "Cliente";

      const currentAmount = Number(rule.current_amount ?? currentTier.final_amount);
      const nextAmount = Number(rule.next_amount ?? nextTier?.final_amount ?? 0);
      const delta = nextAmount > 0 ? nextAmount - currentAmount : 0;

      const payload = {
        proposal_id: proposal.id,
        proposal_number: proposalLabel,
        company_name: companyName,
        opportunity_id: proposal.opportunity_id,
        window: windowKey,
        hours_remaining: hoursRemaining,
        transition_at: currentTier.ends_at,
        current_amount: currentAmount,
        next_amount: nextAmount,
        delta,
        current_tier_label: currentTier.label,
        next_tier_label: nextTier?.label ?? null,
      };

      const { data: evt, error: evtErr } = await supabase
        .from("notification_events")
        .insert({
          event_type: eventSubtype,
          entity_type: "proposal",
          entity_id: proposal.id,
          proposal_id: proposal.id,
          opportunity_id: proposal.opportunity_id,
          organization_id: proposal.organization_id,
          payload,
        })
        .select("id")
        .single();

      if (evtErr) {
        console.error("[tier-transition] event error", evtErr);
        continue;
      }

      // 5) Destinatários: dono da oportunidade + manager
      // Importante: só notificamos se o deal ainda estiver no funil de VENDAS
      // e em status aberto. Deals movidos para Operacional/Onboarding/Renewal
      // ou já marcados como won/lost não devem mais receber alerta de virada
      // de tabela dinâmica (a negociação já foi encerrada).
      const { data: opp } = await supabase
        .from("opportunities")
        .select("owner_user_id, status, pipeline_id, deleted_at, pipelines:pipeline_id(pipeline_type)")
        .eq("id", proposal.opportunity_id)
        .maybeSingle() as { data: any };
      if (!opp?.owner_user_id) continue;
      if (opp.deleted_at) continue;
      if (opp.status && !["new", "in_progress", "open"].includes(String(opp.status))) continue;
      const pipelineType = opp?.pipelines?.pipeline_type ?? null;
      if (pipelineType && pipelineType !== "sales") {
        console.log(
          `[tier-transition] skip ${proposal.id} — opportunity in pipeline_type=${pipelineType}`,
        );
        continue;
      }

      const { data: teamRows } = await supabase
        .from("team_members")
        .select("teams!inner(manager_id)")
        .eq("user_id", opp.owner_user_id)
        .eq("organization_id", proposal.organization_id);

      const managerId = (teamRows || [])
        .map((r: any) => r.teams?.manager_id)
        .find((m: string | null) => m && m !== opp.owner_user_id) || null;

      const recipients = [...new Set(
        [opp.owner_user_id, managerId].filter(Boolean) as string[],
      )];

      // Mensagem elegante — comunica atualização AUTOMÁTICA (não exige ação manual).
      const horizonText =
        windowKey === "72h"
          ? "em 72 horas"
          : windowKey === "48h"
            ? "em 48 horas"
            : "em 24 horas";

      const titleText = `Condição comercial atualiza automaticamente ${horizonText}`;
      const variation = delta > 0 ? `↑ ${BRL(delta)}` : delta < 0 ? `↓ ${BRL(Math.abs(delta))}` : "";
      const transitionLabel = formatTransitionDate(currentTier.ends_at);

      const messageParts = [
        `${proposalLabel} · ${companyName}`,
        `Vigente: ${BRL(currentAmount)}${nextAmount > 0 ? ` → ${BRL(nextAmount)}` : ""}${variation ? ` (${variation})` : ""}`,
        `Atualização automática em: ${transitionLabel}`,
      ];
      const messageText = messageParts.join(" · ");

      const priority =
        windowKey === "24h" ? "high" : windowKey === "48h" ? "medium" : "low";

      const actionUrl = `/app/opportunities/${proposal.opportunity_id}`;

      for (const userId of recipients) {
        const { data: settings } = await supabase
          .from("notification_settings")
          .select(
            "proposal_expiring_alert_enabled, realtime_in_app_enabled, realtime_email_enabled",
          )
          .eq("user_id", userId)
          .maybeSingle();

        // Reusa o mesmo opt-out de "proposta vencendo" (mesma família)
        const alertEnabled = settings?.proposal_expiring_alert_enabled ?? true;
        if (!alertEnabled) continue;

        const channelInApp = settings?.realtime_in_app_enabled ?? true;
        const channelEmail = settings?.realtime_email_enabled ?? false;

        const { error: nErr } = await supabase.from("notifications_v2").insert({
          user_id: userId,
          event_id: evt.id,
          type: eventSubtype,
          title: titleText,
          message: messageText,
          priority,
          channel_in_app: channelInApp,
          channel_email: channelEmail,
          channel_push: false,
          status: "pending",
          action_url: actionUrl,
        });

        if (nErr) {
          console.error("[tier-transition] notif insert error", userId, nErr);
        }
      }

      processed++;
    }

    return new Response(
      JSON.stringify({
        processed,
        scanned: rules.length,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[tier-transition] fatal", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
