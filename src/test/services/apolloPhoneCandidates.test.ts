import { describe, expect, it } from "vitest";
// @ts-ignore — módulo Deno compartilhado, testado como TS puro.
import {
  collectCompanyPhones,
  isBrazilianMobile,
  normalizePhone,
  selectBestPhone,
  toE164,
} from "../../../supabase/functions/_shared/apollo-phone-candidates.ts";

describe("apollo phone candidates (KAI.18.14)", () => {
  it("normaliza e converte para E.164", () => {
    expect(normalizePhone("+55 (45) 99833-2223")).toBe("5545998332223");
    expect(toE164("45998332223")).toBe("+5545998332223");
    expect(isBrazilianMobile("+55 45 99833-2223")).toBe(true);
  });

  it("extrai telefone pessoal em profundidade mesmo com telefone corporativo presente", () => {
    const payload = {
      person: {
        name: "Lucas Angnes",
        organization: { phone: "+55 45 3055-5555" },
        contact: { phone_numbers: [{ sanitized_number: "+55 45 99833-2223", type: "mobile" }] },
      },
    };
    const sel = selectBestPhone(payload);
    expect(sel.outcome).toBe("revealed");
    expect(sel.selected?.e164).toBe("+5545998332223");
    expect(sel.selected?.classification).toBe("person_mobile");
  });

  it("rejeita apenas com evidência objetiva de telefone corporativo", () => {
    const payload = { organization: { phone: "+554530555555" }, person: { phone: "+554530555555" } };
    const sel = selectBestPhone(payload);
    expect(sel.outcome).toBe("rejected_company_phone");
    expect(sel.rejected[0].rejection_reason).toBe("company_exact_match");
  });

  it("não rejeita celular sem tipo só por DDD igual ao da empresa", () => {
    const payload = { organization: { phone: "+55 45 3055-5555" }, person: { phone: "+55 45 99833-2223" } };
    const sel = selectBestPhone(payload);
    expect(sel.outcome).toBe("revealed");
    expect(sel.selected?.classification).toBe("person_unclassified");
  });

  it("marca phone_only_web quando provider sinaliza telefone mas não entrega", () => {
    const sel = selectBestPhone({ person: { has_direct_phone: "Yes" } });
    expect(sel.outcome).toBe("phone_only_web");
    expect(sel.provider_indicates_phone).toBe(true);
  });

  it("marca pending_provider quando permitido e há entradas vazias", () => {
    const sel = selectBestPhone({ person: { phone_numbers: [{ type: "mobile" }] } }, { allowPending: true });
    expect(sel.outcome).toBe("pending_provider");
  });

  it("retorna not_found sem qualquer sinal", () => {
    expect(selectBestPhone({ person: { name: "x" } }).outcome).toBe("not_found");
  });

  it("coleta telefones oficiais da organização e extras", () => {
    const keys = collectCompanyPhones({ organization: { phone: "+554530555555" } }, ["+55 45 3055-5555"]);
    expect(keys.length).toBe(1);
  });
});
