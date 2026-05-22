import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveApprovedProposalAmount,
  APPROVED_VALUE_SELECT_COLUMNS,
} from "../_shared/approved-proposal-value.ts";
import { resolveProposalPaymentDue } from "../_shared/proposal-payment-due.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return jsonResponse({ error: "proposal_id is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: orchestrationError } = await supabase.rpc("orchestrate_proposal_financials", {
      p_proposal_id: proposal_id,
      p_reason: "notify_deal_won_preflight",
    });
    if (orchestrationError) {
      console.error("[notify-deal-won] Financial preflight failed:", orchestrationError);
    }

    // PRICE CORE 2.0C — central pricing guard. Recalculates the ledger and
    // blocks ERP delivery when the proposal has any divergence.
    const { data: readiness, error: readinessError } = await supabase.rpc(
      "ensure_proposal_pricing_ready",
      { p_proposal_id: proposal_id },
    );
    if (readinessError) {
      console.error("[notify-deal-won] ensure_proposal_pricing_ready failed:", readinessError);
      return jsonResponse({
        error: "Não foi possível enviar ao ERP. Falha ao validar valores da proposta.",
        reason: "pricing_guard_error",
      }, 500);
    }
    if (!readiness || readiness.ok === false || readiness.blocked === true) {
      const message = readiness?.message ||
        "Não foi possível enviar ao ERP. Existem valores divergentes na proposta. Recalcule a proposta antes de continuar.";
      console.error("[notify-deal-won] BLOCKED by pricing guard:", JSON.stringify(readiness));
      return jsonResponse({
        error: message,
        reason: readiness?.reason || "ledger_divergence",
        readiness,
      }, 409);
    }

    // Fetch proposal after preflight so ERP always receives the final NET approved amount.
    const { data: proposal, error: pError } = await supabase
      .from("proposals")
      .select(
        `id, opportunity_id, organization_id, status, title, client_name, client_email, created_at, accepted_at, expires_at, subtotal, discount_amount, approved_payment_schedule, approval_snapshot, pricing_erp_amount, pricing_effective_amount, pricing_breakdown_snapshot, pricing_has_divergence, ${APPROVED_VALUE_SELECT_COLUMNS}`,
      )
      .eq("id", proposal_id)
      .single();

    if (pError || !proposal) {
      console.error("Proposal not found:", proposal_id, pError);
      return jsonResponse({ error: "Proposal not found" }, 404);
    }


    if (proposal.status !== "accepted") {
      return jsonResponse({ error: "Proposal is not accepted", status: proposal.status }, 400);
    }

    // Fetch opportunity
    let opportunity: Record<string, unknown> | null = null;
    if (proposal.opportunity_id) {
      const { data } = await supabase
        .from("opportunities")
        .select("id, title, account_id, contact_id, valor_previsto, pipeline_id, stage_id")
        .eq("id", proposal.opportunity_id)
        .maybeSingle();
      opportunity = data;
    }

    // Fetch account
    let account: Record<string, unknown> | null = null;
    const accountId = opportunity?.account_id as string | null;
    if (accountId) {
      const { data } = await supabase
        .from("accounts")
        .select("id, razao_social, nome_fantasia, cnpj, cpf, emails, telefones, tipo_pessoa, cidade, uf, cep, logradouro, numero, bairro, complemento")
        .eq("id", accountId)
        .maybeSingle();
      account = data;
    }

    // Fetch contact
    let contact: Record<string, unknown> | null = null;
    const contactId = opportunity?.contact_id as string | null;
    if (contactId) {
      const { data } = await supabase
        .from("contacts")
        .select("id, nome, cargo, emails, telefones")
        .eq("id", contactId)
        .maybeSingle();
      contact = data;
    }

    // Fetch items with correct column names
    const { data: items } = await supabase
      .from("proposal_items")
      .select("id, product_id, name, description, quantity, unit_price, discount_percent, total, billing_type, minimum_contract_months")
      .eq("proposal_id", proposal_id)
      .order("order_index");

    // Fetch payment terms — proposal_payment_terms can have multiple rows per proposal
    // (legacy duplicates). Always take the MOST RECENT row so the ERP receives the
    // up-to-date payment date defined by the user.
    const { data: paymentTermsList } = await supabase
      .from("proposal_payment_terms")
      .select("id, payment_type, payment_condition, installments, installment_interval_days, first_installment_date, first_payment_date, contract_start_date, contract_duration_months, monthly_value, contract_total, billing_day, comments, discount_percent, entry_date, payment_due_days, second_payment_due_date, updated_at, created_at")
      .eq("proposal_id", proposal_id)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    const dueResolution = resolveProposalPaymentDue(proposal as any, paymentTermsList as any[]);
    const paymentTerms = dueResolution.paymentTerms;
    console.log(`[notify-deal-won] paymentTerms resolved for ${proposal_id}:`, JSON.stringify(paymentTerms));

    // Compute the legacy item-based total for auditing/observability only.
    const rawTotal = (items || []).reduce((sum: number, item: Record<string, unknown>) => {
      return sum + (Number(item.total) || 0);
    }, 0);
    const paymentDiscountPercent = Number(paymentTerms?.discount_percent) || 0;
    let itemsNetTotal = rawTotal;
    if (paymentDiscountPercent > 0) {
      const oneTimeTotal = (items || []).reduce((sum: number, item: Record<string, unknown>) => {
        return sum + ((item.billing_type !== "recurring") ? (Number(item.total) || 0) : 0);
      }, 0);
      const discountAmount = oneTimeTotal * (paymentDiscountPercent / 100);
      itemsNetTotal = rawTotal - discountAmount;
    }

    // PRICE CORE 2.0C — pricing_erp_amount is the canonical ERP figure.
    // It already includes manual discount, inventory adjustment, dynamic
    // pricing, payment discount and is frozen by approval_snapshot when the
    // proposal is accepted.
    const pricingErpAmount = Number((proposal as any).pricing_erp_amount) || 0;
    const approved = resolveApprovedProposalAmount(proposal as any);
    const totalAmount = pricingErpAmount > 0
      ? pricingErpAmount
      : (approved.amount > 0 ? approved.amount : itemsNetTotal);

    const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

    // Financial breakdown — same shape as api-deals so the ERP receives an
    // unambiguous NET value across every legacy field name. Gross/source
    // values must stay only inside noid_financial_audit so the ERP cannot
    // accidentally pick subtotal/items gross as the receivable amount.
    const proposalSubtotal = Number((proposal as any).subtotal) || 0;
    const proposalDiscountAmount = Number((proposal as any).discount_amount) || 0;
    const subtotalForBreakdown = proposalSubtotal > 0 ? proposalSubtotal : rawTotal;
    const netTotal = roundMoney(totalAmount);
    const discountTotal = proposalDiscountAmount > 0
      ? proposalDiscountAmount
      : Math.max(subtotalForBreakdown - netTotal, 0);
    const discountPercent = subtotalForBreakdown > 0
      ? Number(((discountTotal / subtotalForBreakdown) * 100).toFixed(2))
      : 0;

    console.log(
      `[notify-deal-won] ERP value for ${proposal_id}: net=${netTotal} pricing_erp_amount=${pricingErpAmount} subtotal=${subtotalForBreakdown} discount=${discountTotal} (${discountPercent}%) source=${approved.source} base=${approved.base_amount} dyn=${approved.dynamic_amount} items_gross=${rawTotal} items_net=${itemsNetTotal}`,
    );


    // Derive vencimento — sempre priorizar a data definida nas condições de pagamento.
    // Ordem de prioridade: first_installment_date (à vista / 1ª parcela one_time)
    //  → entry_date (entrada) → first_payment_date → contract_start_date.
    const vencimento = dueResolution.vencimento;
    console.log(`[notify-deal-won] vencimento for ${proposal_id} = ${vencimento} (source=${dueResolution.source})`);

    // Scale per-item totals so Σ products[].total_price === netTotal.
    // Some ERP integrations sum line items instead of reading the deal-level
    // amount; without scaling we'd send the gross items total (e.g. 985)
    // even when net is 1.199,83. Unit price / quantity remain untouched
    // for human-readable presentation.
    const itemsArr = items || [];
    const grossSum = itemsArr.reduce(
      (s: number, it: Record<string, unknown>) => s + (Number(it.total) || 0),
      0,
    );
    const scaleFactor = grossSum > 0 ? netTotal / grossSum : 1;
    const scaledItems = itemsArr.map((item, idx) => {
      const original = Number(item.total) || 0;
      let scaled = roundMoney(original * scaleFactor);
      // Force last item to absorb rounding so the sum matches netTotal exactly.
      if (idx === itemsArr.length - 1) {
        const sumSoFar = itemsArr
          .slice(0, idx)
          .reduce((s, it) => s + Math.round((Number(it.total) || 0) * scaleFactor * 100) / 100, 0);
        scaled = roundMoney(netTotal - sumSoFar);
      }
      const quantity = Number(item.quantity) || 1;
      const scaledUnitPrice = roundMoney(scaled / quantity);
      return { item, original, scaled, quantity, scaledUnitPrice };
    });
    const scaledSum = scaledItems.reduce((s, x) => s + x.scaled, 0);
    console.log(
      `[notify-deal-won] items scaled: count=${itemsArr.length} factor=${scaleFactor} gross=${grossSum} scaled_sum=${scaledSum} net=${netTotal}`,
    );


    // Extract email/phone from account (JSONB format: [{value: "..."}])
    const rawEmails = account?.emails as unknown;
    let companyEmail: string | null = null;
    if (Array.isArray(rawEmails) && rawEmails.length > 0) {
      const first = rawEmails[0];
      companyEmail = typeof first === "string" ? first : (first as Record<string, unknown>)?.value as string || null;
    }

    const telefones = account?.telefones as unknown;
    let companyPhone: string | null = null;
    if (Array.isArray(telefones) && telefones.length > 0) {
      const first = telefones[0];
      companyPhone = typeof first === "string" ? first : (first as Record<string, unknown>)?.numero as string || (first as Record<string, unknown>)?.value as string || null;
    }

    // Build deal payload for ERP — every monetary field carries the NET
    // approved value so the ERP cannot accidentally pick a gross/legacy field.
    const dealPayload = {
      id: proposal.id,
      title: (opportunity?.title as string) || proposal.title || "Sem título",
      // Primary fields (NET — already includes dynamic pricing + discount)
      amount: netTotal,
      net_total: netTotal,
      final_amount: netTotal,
      valor_liquido: netTotal,
      valor: netTotal,
      value: netTotal,
      valor_total: netTotal,
      valor_venda: netTotal,
      total_with_discount: netTotal,
      total_negotiated: netTotal,
      total_amount: netTotal,
      subtotal: netTotal,
      gross_total: netTotal,
      discount_total: discountTotal,
      discount_percent: discountPercent,
      base_amount: approved.base_amount || itemsNetTotal,
      approved_amount: approved.amount || null,
      amount_source: approved.source,
      // PRICE CORE 2.0C — canonical ledger fields for auditing on ERP side.
      pricing_erp_amount: pricingErpAmount || null,
      pricing_breakdown_snapshot: (proposal as any).pricing_breakdown_snapshot || null,
      approval_snapshot: (proposal as any).approval_snapshot || null,
      noid_financial_audit: {
        canonical_amount: netTotal,
        original_subtotal: subtotalForBreakdown,
        original_items_gross_total: grossSum,
        original_items_net_total: itemsNetTotal,
        discount_total: discountTotal,
        discount_percent: discountPercent,
        pricing_erp_amount: pricingErpAmount || null,
        approved_amount: approved.amount || null,
        amount_source: approved.source,
      },
      dynamic_pricing_enabled: approved.dynamic_enabled,
      dynamic_pricing_status: approved.dynamic_status,
      dynamic_pricing_snapshot: approved.snapshot,

      status: "won",
      won_date: proposal.accepted_at,
      created_at: proposal.created_at,
      expires_at: proposal.expires_at,
      vencimento,
      company_name: (account?.razao_social as string) || proposal.client_name || null,
      company_trade_name: (account?.nome_fantasia as string) || null,
      company_document: (account?.cnpj as string) || (account?.cpf as string) || null,
      company_document_type: account?.cnpj ? "cnpj" : account?.cpf ? "cpf" : null,
      company_email: companyEmail,
      company_phone: companyPhone,
      company_type: (account?.tipo_pessoa as string) || null,
      company_city: (account?.cidade as string) || null,
      company_state: (account?.uf as string) || null,
      company_zip: (account?.cep as string) || null,
      company_address: account ? [account.logradouro, account.numero, account.complemento, account.bairro].filter(Boolean).join(", ") : null,
      contact_name: (contact?.nome as string) || proposal.client_name || null,
      contact_email: (Array.isArray(contact?.emails) && contact.emails.length > 0
        ? (typeof contact.emails[0] === 'string'
            ? contact.emails[0]
            : (contact.emails[0] as Record<string, unknown>)?.value)
        : null) as string | null || proposal.client_email || null,
      contact_phone: (Array.isArray(contact?.telefones) && contact.telefones.length > 0
        ? (typeof contact.telefones[0] === 'string'
            ? contact.telefones[0]
            : ((contact.telefones[0] as Record<string, unknown>)?.numero || (contact.telefones[0] as Record<string, unknown>)?.value))
        : null) as string | null,
      contact_position: (contact?.cargo as string) || null,
      // Products: total_price scaled so Σ === netTotal. unit_price/quantity preserved
      // for human reading; original_total_price kept for auditing.
      products: scaledItems.map(({ item, original, scaled, quantity, scaledUnitPrice }) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        description: item.description,
        price: scaledUnitPrice,
        unit_price: scaledUnitPrice,
        amount: scaled,
        net_total: scaled,
        final_amount: scaled,
        quantity,
        discount_percent: Number(item.discount_percent) || 0,
        total_price: scaled,
        net_total_price: scaled,
        noid_original_pricing: {
          unit_price: Number(item.unit_price) || 0,
          total_price: original,
        },
        billing_type: item.billing_type || "one_time",
        minimum_contract_months: item.minimum_contract_months ? Number(item.minimum_contract_months) : null,
      })),
      payment_terms: paymentTerms
        ? {
            payment_type: paymentTerms.payment_type,
            installments: paymentTerms.installments,
            installment_interval_days: paymentTerms.installment_interval_days,
            first_installment_date: paymentTerms.first_installment_date,
            first_payment_date: paymentTerms.first_payment_date,
            contract_start_date: paymentTerms.contract_start_date,
            contract_duration_months: paymentTerms.contract_duration_months,
            monthly_value: paymentTerms.monthly_value ? Number(paymentTerms.monthly_value) : null,
            contract_total: netTotal,
            billing_day: paymentTerms.billing_day,
            comments: paymentTerms.comments,
            vencimento,
          }
        : null,
    };

    // Send to Umma ERP
    const webhookUrl = Deno.env.get("UMMA_ERP_WEBHOOK_URL") || "https://ipkfufivmtodhiykoerz.supabase.co/functions/v1/sync-deals?action=webhook";
    const erpApiKey = Deno.env.get("UMMA_ERP_API_KEY");

    if (!erpApiKey) {
      console.error("[notify-deal-won] UMMA_ERP_API_KEY secret not configured. Cannot send deal to ERP.");
      return jsonResponse({ error: "ERP API key not configured" }, 500);
    }

    console.log(`[notify-deal-won] Sending deal ${proposal.id} to ERP: ${webhookUrl}`);
    console.log(`[notify-deal-won] Deal payload: title='${dealPayload.title}', amount=${dealPayload.amount}, company='${dealPayload.company_name}'`);

    const erpResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": erpApiKey,
      },
      body: JSON.stringify(dealPayload),
    });

    const erpBody = await erpResponse.text();
    const success = erpResponse.ok;

    console.log(`[notify-deal-won] ERP response: ${erpResponse.status} - ${erpBody}`);

    if (!success) {
      console.error(`[notify-deal-won] ERP webhook FAILED: status=${erpResponse.status}, body=${erpBody}`);
    }

    return jsonResponse({
      success,
      erp_status: erpResponse.status,
      proposal_id: proposal.id,
      message: success ? "Deal sent to ERP successfully" : "ERP webhook failed",
    });
  } catch (err) {
    console.error("notify-deal-won error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
