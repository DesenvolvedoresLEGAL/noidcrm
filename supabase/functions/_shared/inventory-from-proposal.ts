// Server-side port of src/services/operations/inventoryProposalBridge.ts
// Generates a pre-reservation from a proposal with full ponto-dia + BOM expansion.
// Idempotent: if any non-cancelled pre-reservation already exists for the proposal,
// it is reused instead of creating a duplicate.

type Sb = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>;

export type InventoryFromProposalResult =
  | { status: "created"; pre_reservation_id: string; items_created: number; items_skipped: number; details: any }
  | { status: "reused"; pre_reservation_id: string; details: any }
  | { status: "no_event_date"; details: any }
  | { status: "no_inventory_items"; details: any }
  | { status: "no_items"; details: any }
  | { status: "error"; error: string };

interface ProductCfg {
  id: string;
  inventory_control_mode: string | null;
  default_inventory_item_type: string | null;
  default_serialized_item_id: string | null;
  default_quantity_item_id: string | null;
  default_inventory_category_id: string | null;
  default_inventory_family_id: string | null;
  inventory_quantity_multiplier: number | null;
  inventory_demand_rules: any[] | null;
}

function addDays(d: Date, n: number) {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function resolveEventDates(
  supabase: Sb,
  proposal: any,
  opportunityId: string | null,
  items: any[],
): Promise<{ start: string | null; end: string | null; source: string }> {
  // 1. proposals.event_start_date / event_end_date
  if (proposal.event_start_date) {
    const start = proposal.event_start_date as string;
    const end = (proposal.event_end_date as string) || start;
    return { start, end, source: "proposal" };
  }

  // 2. proposal_dynamic_pricing_rules.event_start_date
  const { data: rule } = await supabase
    .from("proposal_dynamic_pricing_rules")
    .select("event_start_date")
    .eq("proposal_id", proposal.id)
    .maybeSingle();
  if (rule?.event_start_date) {
    const start = rule.event_start_date as string;
    return { start, end: start, source: "dynamic_pricing_rule" };
  }

  // 3. opportunities.event_start_date / event_end_date
  if (opportunityId) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("event_start_date, event_end_date")
      .eq("id", opportunityId)
      .maybeSingle();
    if (opp?.event_start_date) {
      const start = opp.event_start_date as string;
      let end = (opp.event_end_date as string) || start;
      // If we have point_day items, extend end by max(billing_days)-1
      const maxDays = Math.max(
        0,
        ...items
          .filter((it) => it.billing_type === "point_day")
          .map((it) => Number(it.billing_days ?? 0)),
      );
      if (maxDays > 0 && end === start) {
        end = toIsoDate(addDays(new Date(start + "T00:00:00Z"), maxDays - 1));
      }
      return { start, end, source: "opportunity" };
    }
  }

  return { start: null, end: null, source: "none" };
}

function computeOperationalPeriod(eventStart: string, eventEnd: string) {
  const s = new Date(eventStart + "T00:00:00Z");
  const e = new Date(eventEnd + "T00:00:00Z");
  return {
    operational_start_date: toIsoDate(addDays(s, -1)),
    operational_end_date: toIsoDate(addDays(e, 1)),
  };
}

export async function generatePreReservationFromProposalServer(
  supabase: Sb,
  proposalId: string,
): Promise<InventoryFromProposalResult> {
  try {
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(
        "id, title, organization_id, opportunity_id, client_name, event_start_date, event_end_date",
      )
      .eq("id", proposalId)
      .maybeSingle();
    if (pErr || !proposal) {
      return { status: "error", error: pErr?.message ?? "Proposal not found" };
    }

    // Idempotency: skip if any non-cancelled pre-reservation already exists
    const { data: existing } = await supabase
      .from("inventory_pre_reservations")
      .select("id")
      .eq("proposal_id", proposalId)
      .neq("status", "cancelled")
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        status: "reused",
        pre_reservation_id: existing[0].id,
        details: { reason: "pre_reservation_already_exists" },
      };
    }

    const { data: items, error: iErr } = await supabase
      .from("proposal_items")
      .select("id, name, quantity, product_id, billing_type, quantity_points, billing_days")
      .eq("proposal_id", proposalId);
    if (iErr) return { status: "error", error: iErr.message };

    if (!items || items.length === 0) {
      return { status: "no_items", details: { proposal_id: proposalId } };
    }

    // Resolve dates
    const dates = await resolveEventDates(
      supabase,
      proposal,
      proposal.opportunity_id ?? null,
      items,
    );
    if (!dates.start || !dates.end) {
      return {
        status: "no_event_date",
        details: { proposal_id: proposalId, source: dates.source },
      };
    }

    // Load product configs
    const productIds = Array.from(
      new Set(items.map((it: any) => it.product_id).filter(Boolean)),
    ) as string[];
    let productMap = new Map<string, ProductCfg>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select(
          "id, inventory_control_mode, default_inventory_item_type, default_serialized_item_id, default_quantity_item_id, default_inventory_category_id, default_inventory_family_id, inventory_quantity_multiplier, inventory_demand_rules",
        )
        .in("id", productIds);
      productMap = new Map(((products ?? []) as ProductCfg[]).map((p) => [p.id, p]));
    }

    // Load BOM rows
    const bomMap = new Map<string, any[]>();
    if (productIds.length > 0) {
      const { data: bomRows } = await supabase
        .from("product_bom_items")
        .select(
          "product_id, component_product_id, inventory_category_id, inventory_family_id, quantity_per_point, label",
        )
        .in("product_id", productIds);
      for (const row of (bomRows ?? []) as any[]) {
        const arr = bomMap.get(row.product_id) ?? [];
        arr.push(row);
        bomMap.set(row.product_id, arr);
      }
    }

    // Build reservation items + track skipped
    const reservationItems: any[] = [];
    const skipped: any[] = [];
    for (const it of items as any[]) {
      const cfg = it.product_id ? productMap.get(it.product_id) : undefined;
      if (!cfg || cfg.inventory_control_mode === "none" || !cfg.inventory_control_mode) {
        skipped.push({
          proposal_item_id: it.id,
          name: it.name,
          product_id: it.product_id,
          reason: "product_inventory_control_mode_none",
        });
        continue;
      }
      const physicalQty =
        it.billing_type === "point_day"
          ? Number(it.quantity_points ?? 1)
          : Number(it.quantity ?? 1);
      const baseQty = physicalQty * Number(cfg.inventory_quantity_multiplier ?? 1);

      const bom = it.product_id ? bomMap.get(it.product_id) : undefined;
      if (it.billing_type === "point_day" && bom && bom.length > 0) {
        for (const comp of bom) {
          const qty = physicalQty * Number(comp.quantity_per_point ?? 1);
          if (!qty) continue;
          reservationItems.push({
            inventory_item_type: "category_family_demand",
            category_id: comp.inventory_category_id ?? cfg.default_inventory_category_id ?? null,
            family_id: comp.inventory_family_id ?? cfg.default_inventory_family_id ?? null,
            requested_quantity: qty,
            demand_label: comp.label ?? `${it.name} — componente`,
            demand_source: "product_rule",
            product_id: comp.component_product_id ?? it.product_id ?? null,
            proposal_item_id: it.id,
            notes: it.name,
          });
        }
        continue;
      }

      const rules = Array.isArray(cfg.inventory_demand_rules) ? cfg.inventory_demand_rules : [];
      if (rules.length > 0) {
        for (const rule of rules) {
          const ruleQty = baseQty * Number(rule.quantity_multiplier ?? 1);
          if (!ruleQty) continue;
          reservationItems.push({
            inventory_item_type: "category_family_demand",
            category_id: rule.category_id ?? cfg.default_inventory_category_id ?? null,
            family_id: rule.family_id ?? cfg.default_inventory_family_id ?? null,
            requested_quantity: ruleQty,
            demand_label: rule.label ?? it.name,
            demand_source: "product_rule",
            product_id: it.product_id ?? null,
            proposal_item_id: it.id,
            notes: it.name,
          });
        }
        continue;
      }

      if (cfg.inventory_control_mode === "direct_serialized_item" && cfg.default_serialized_item_id) {
        reservationItems.push({
          inventory_item_type: "serialized",
          serialized_item_id: cfg.default_serialized_item_id,
          category_id: cfg.default_inventory_category_id,
          family_id: cfg.default_inventory_family_id,
          requested_quantity: 1,
          demand_source: "proposal_item",
          product_id: it.product_id ?? null,
          proposal_item_id: it.id,
          notes: it.name,
        });
      } else if (cfg.inventory_control_mode === "direct_quantity_item" && cfg.default_quantity_item_id) {
        reservationItems.push({
          inventory_item_type: "quantity",
          quantity_item_id: cfg.default_quantity_item_id,
          category_id: cfg.default_inventory_category_id,
          family_id: cfg.default_inventory_family_id,
          requested_quantity: baseQty,
          demand_source: "proposal_item",
          product_id: it.product_id ?? null,
          proposal_item_id: it.id,
          notes: it.name,
        });
      } else if (cfg.inventory_control_mode === "category_family_demand") {
        reservationItems.push({
          inventory_item_type: "category_family_demand",
          category_id: cfg.default_inventory_category_id,
          family_id: cfg.default_inventory_family_id,
          requested_quantity: baseQty,
          demand_label: it.name,
          demand_source: "proposal_item",
          product_id: it.product_id ?? null,
          proposal_item_id: it.id,
          notes: it.name,
        });
      } else {
        skipped.push({
          proposal_item_id: it.id,
          name: it.name,
          product_id: it.product_id,
          reason: "missing_default_inventory_target",
        });
      }
    }

    if (reservationItems.length === 0) {
      return {
        status: "no_inventory_items",
        details: {
          proposal_id: proposalId,
          skipped,
          dates,
        },
      };
    }

    const period = computeOperationalPeriod(dates.start, dates.end);

    // Resolve account/contact via opportunity
    let accountId: string | null = null;
    let contactId: string | null = null;
    if (proposal.opportunity_id) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("account_id, contact_id")
        .eq("id", proposal.opportunity_id)
        .maybeSingle();
      accountId = (opp?.account_id as string) ?? null;
      contactId = (opp?.contact_id as string) ?? null;
    }

    const { data: pre, error: prErr } = await supabase
      .from("inventory_pre_reservations")
      .insert({
        organization_id: proposal.organization_id,
        proposal_id: proposalId,
        opportunity_id: proposal.opportunity_id ?? null,
        account_id: accountId,
        contact_id: contactId,
        title:
          proposal.title ||
          `Pré reserva proposta ${proposal.client_name ?? ""}`.trim(),
        source: "proposal",
        operational_start_date: period.operational_start_date,
        operational_end_date: period.operational_end_date,
        event_start_date: dates.start,
        event_end_date: dates.end,
        status: "active",
        notes: `Gerada automaticamente a partir do aceite da proposta (${dates.source}).`,
      })
      .select("id")
      .single();
    if (prErr || !pre) {
      return { status: "error", error: prErr?.message ?? "Failed to create pre-reservation" };
    }

    const itemRows = reservationItems.map((it) => ({
      organization_id: proposal.organization_id,
      pre_reservation_id: pre.id,
      inventory_item_type: it.inventory_item_type,
      serialized_item_id: it.serialized_item_id ?? null,
      quantity_item_id: it.quantity_item_id ?? null,
      category_id: it.category_id ?? null,
      family_id: it.family_id ?? null,
      requested_quantity: it.requested_quantity,
      notes: it.notes ?? null,
      demand_label: it.demand_label ?? null,
      demand_source: it.demand_source ?? "proposal_item",
      product_id: it.product_id ?? null,
      proposal_item_id: it.proposal_item_id ?? null,
    }));

    const { error: itErr } = await supabase
      .from("inventory_pre_reservation_items")
      .insert(itemRows);
    if (itErr) {
      return { status: "error", error: `items insert: ${itErr.message}` };
    }

    // Recalc availability/risk
    try {
      await supabase.rpc("recalculate_inventory_pre_reservation_status", {
        p_pre_reservation_id: pre.id,
      });
    } catch (e) {
      console.warn("[inventory] recalculate failed (non-fatal):", e);
    }

    return {
      status: "created",
      pre_reservation_id: pre.id,
      items_created: itemRows.length,
      items_skipped: skipped.length,
      details: { skipped, dates },
    };
  } catch (e: any) {
    return { status: "error", error: e?.message ?? String(e) };
  }
}
