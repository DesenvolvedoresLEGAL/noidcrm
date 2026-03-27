import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch proposal
    const { data: proposal, error: pError } = await supabase
      .from("proposals")
      .select("id, opportunity_id, organization_id, status, title, client_name, client_email, value, created_at, accepted_at, expires_at")
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
        .select("id, title, account_id, contact_id, value, pipeline_id, stage_id")
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
        .select("id, name, email, phone, position")
        .eq("id", contactId)
        .maybeSingle();
      contact = data;
    }

    // Fetch items
    const { data: items } = await supabase
      .from("proposal_items")
      .select("id, product_id, product_name, description, quantity, unit_price, discount_percent, total_price, billing_type, billing_cycle, monthly_price, minimum_contract_months")
      .eq("proposal_id", proposal_id)
      .order("sort_order");

    // Fetch payment terms
    const { data: paymentTerms } = await supabase
      .from("proposal_payment_terms")
      .select("payment_type, installments, installment_interval, first_due_date, contract_duration_months, monthly_value, total_value, billing_day, notes")
      .eq("proposal_id", proposal_id)
      .maybeSingle();

    const totalAmount = (items || []).reduce((sum: number, item: Record<string, unknown>) => {
      return sum + (Number(item.total_price) || 0);
    }, 0);

    const emails = (account?.emails as string[]) || [];
    const telefones = account?.telefones as unknown;
    let companyPhone: string | null = null;
    if (Array.isArray(telefones) && telefones.length > 0) {
      const first = telefones[0];
      companyPhone = typeof first === "string" ? first : (first as Record<string, unknown>)?.numero as string || null;
    }

    // Build deal payload for ERP
    const dealPayload = {
      id: proposal.id,
      title: (opportunity?.title as string) || proposal.title || "Sem título",
      amount: totalAmount,
      status: "won",
      won_date: proposal.accepted_at,
      created_at: proposal.created_at,
      expires_at: proposal.expires_at,
      company_name: (account?.razao_social as string) || proposal.client_name || null,
      company_trade_name: (account?.nome_fantasia as string) || null,
      company_document: (account?.cnpj as string) || (account?.cpf as string) || null,
      company_document_type: account?.cnpj ? "cnpj" : account?.cpf ? "cpf" : null,
      company_email: emails[0] || null,
      company_phone: companyPhone,
      company_type: (account?.tipo_pessoa as string) || null,
      company_city: (account?.cidade as string) || null,
      company_state: (account?.uf as string) || null,
      company_zip: (account?.cep as string) || null,
      company_address: account ? [account.logradouro, account.numero, account.complemento, account.bairro].filter(Boolean).join(", ") : null,
      contact_name: (contact?.name as string) || proposal.client_name || null,
      contact_email: (contact?.email as string) || proposal.client_email || null,
      contact_phone: (contact?.phone as string) || null,
      contact_position: (contact?.position as string) || null,
      products: (items || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.product_name,
        description: item.description,
        price: Number(item.unit_price) || 0,
        quantity: Number(item.quantity) || 1,
        discount_percent: Number(item.discount_percent) || 0,
        total_price: Number(item.total_price) || 0,
        billing_type: item.billing_type || "one_time",
        billing_cycle: item.billing_cycle,
        monthly_price: item.monthly_price ? Number(item.monthly_price) : null,
        minimum_contract_months: item.minimum_contract_months ? Number(item.minimum_contract_months) : null,
      })),
      payment_terms: paymentTerms
        ? {
            payment_type: paymentTerms.payment_type,
            installments: paymentTerms.installments,
            installment_interval: paymentTerms.installment_interval,
            first_due_date: paymentTerms.first_due_date,
            contract_duration_months: paymentTerms.contract_duration_months,
            monthly_value: paymentTerms.monthly_value ? Number(paymentTerms.monthly_value) : null,
            total_value: paymentTerms.total_value ? Number(paymentTerms.total_value) : null,
            billing_day: paymentTerms.billing_day,
            notes: paymentTerms.notes,
          }
        : null,
    };

    // Send to Umma ERP
    const webhookUrl = Deno.env.get("UMMA_ERP_WEBHOOK_URL") || "https://ipkfufivmtodhiykoerz.supabase.co/functions/v1/sync-deals?action=webhook";
    const erpApiKey = Deno.env.get("UMMA_ERP_API_KEY");

    if (!erpApiKey) {
      console.error("UMMA_ERP_API_KEY not configured");
      return jsonResponse({ error: "ERP API key not configured" }, 500);
    }

    console.log(`Sending deal ${proposal.id} to ERP: ${webhookUrl}`);

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

    console.log(`ERP response: ${erpResponse.status} - ${erpBody}`);

    if (!success) {
      console.error(`ERP webhook failed: ${erpResponse.status} - ${erpBody}`);
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
