import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABACATEPAY_API_URL = "https://api.abacatepay.com/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ABACATEPAY_API_KEY = Deno.env.get("ABACATEPAY_API_KEY");
    if (!ABACATEPAY_API_KEY) {
      throw new Error("ABACATEPAY_API_KEY not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { planId, organizationId, action } = await req.json();

    console.log("AbacatePay checkout request:", { planId, organizationId, action });

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    // Get organization details
    const { data: org, error: orgError } = await supabaseClient
      .from("organizations")
      .select("id, name, email")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      throw new Error("Organization not found");
    }

    // Define plan products
    const PLAN_PRODUCTS: Record<string, { productId: string; price: number; name: string }> = {
      neural: {
        productId: "prod_SD1K6G40UqeZbb",
        price: 19990,
        name: "Plano Neural",
      },
      pro: {
        productId: "prod_kwYSfmQaQPExU",
        price: 49990,
        name: "Plano Pro",
      },
      enterprise: {
        productId: "prod_ZHGW2ah5n4Cw2",
        price: 99990,
        name: "Enterprise",
      },
      setup_basic: {
        productId: "prod_rP1NqABUtmbKJc",
        price: 500000,
        name: "Setup Basic - 10h",
      },
      setup_matrix: {
        productId: "prod_1h6ngRb1uQwCBb",
        price: 1200000,
        name: "Setup Autonomous - 24h",
      },
    };

    // Handle add payment method action
    if (action === "add_payment_method") {
      const checkoutResponse = await fetch(`${ABACATEPAY_API_URL}/billing/setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            email: org.email || "noemail@example.com",
            name: org.name,
          },
          success_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing/payment?success=true`,
          cancel_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing/payment?canceled=true`,
          metadata: {
            organization_id: organizationId,
            action: "add_payment_method",
          },
        }),
      });

      if (!checkoutResponse.ok) {
        const errorText = await checkoutResponse.text();
        console.error("AbacatePay setup error:", errorText);
        throw new Error("Failed to create payment setup session");
      }

      const checkoutData = await checkoutResponse.json();

      return new Response(JSON.stringify({ checkoutUrl: checkoutData.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle migrate from proposal action (creates subscription with custom price)
    if (action === "migrate_from_proposal") {
      const { customPrice } = await req.json().catch(() => ({}));
      
      // Use custom price or plan default
      const plan = PLAN_PRODUCTS[planId] || PLAN_PRODUCTS.neural;
      const finalPrice = customPrice || plan.price;

      console.log("Migrate from proposal:", { planId, customPrice, finalPrice });

      const checkoutResponse = await fetch(`${ABACATEPAY_API_URL}/billing/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            email: org.email || "noemail@example.com",
            name: org.name,
          },
          products: [
            {
              external_id: plan.productId,
              name: plan.name,
              quantity: 1,
              price: finalPrice,
            },
          ],
          frequency: "monthly",
          success_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing?success=true&migrated=true`,
          cancel_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing?canceled=true`,
          metadata: {
            organization_id: organizationId,
            plan_id: planId,
            plan_name: plan.name,
            migrated_from_proposal: true,
          },
        }),
      });

      if (!checkoutResponse.ok) {
        const errorText = await checkoutResponse.text();
        console.error("AbacatePay migrate checkout error:", errorText);
        throw new Error("Failed to create checkout session for migration");
      }

      const checkoutData = await checkoutResponse.json();
      console.log("Migrate checkout created:", checkoutData.id);

      return new Response(
        JSON.stringify({
          checkoutUrl: checkoutData.url,
          sessionId: checkoutData.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Handle subscription checkout
    if (!planId) {
      throw new Error("Plan ID is required for subscription checkout");
    }

    const plan = PLAN_PRODUCTS[planId];
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    // Create AbacatePay checkout session
    const checkoutResponse = await fetch(`${ABACATEPAY_API_URL}/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: {
          email: org.email || "noemail@example.com",
          name: org.name,
        },
        products: [
          {
            external_id: plan.productId,
            name: plan.name,
            quantity: 1,
            price: plan.price,
          },
        ],
        frequency: "monthly",
        success_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing?success=true`,
        cancel_url: `${Deno.env.get("APP_URL") || "https://app.noid.com.br"}/app/settings/billing?canceled=true`,
        metadata: {
          organization_id: organizationId,
          plan_id: planId,
          plan_name: plan.name,
        },
      }),
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text();
      console.error("AbacatePay checkout error:", errorText);
      throw new Error("Failed to create checkout session");
    }

    const checkoutData = await checkoutResponse.json();

    console.log("AbacatePay checkout created:", checkoutData.id);

    return new Response(
      JSON.stringify({
        checkoutUrl: checkoutData.url,
        sessionId: checkoutData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("AbacatePay checkout error:", error);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
