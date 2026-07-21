# Phase 4 — Opportunity Account/Contact Tenant Matrix (NSEC-1.2-CHG-021)

## 1. Contexto
Fecha o ciclo de homologação relacional de `public.opportunities` iniciado na CHG-019/020. A CHG-020 fixou a policy `nsec12_opportunities_insert_account_contact_tenant_guard` (RESTRICTIVE, INSERT, WITH CHECK) que valida `accounts.organization_id` e `contacts.organization_id` contra `opportunities.organization_id`. Esta mudança executa a matriz por papel (owner/admin/manager/sales/viewer/cs × Org A/Org B) e remove a RPC temporária de probes.

## 2. Escopo
- Tabela: `public.opportunities`
- Operação: INSERT via RPC temporária SECURITY INVOKER
- Personas: 12 usuários sintéticos (6 papéis × 2 orgs)
- Fixtures: Org A/B, Pipeline A/B, Stage A/B, Account A/B, Contact A/B oficiais

## 3. Limitação same-tenant
Não testada nesta mudança: incompatibilidade `opportunities.account_id ≠ contacts.account_id` dentro do mesmo tenant. Motivo: existe uma única account e um único contact oficial por tenant, sem fixtures de incompatibilidade same-tenant. O contato órfão (`b53de59c-…-fcb3`) permanece explicitamente rejeitado pela whitelist da RPC.

## 4. Policies ativas em `public.opportunities` (pré e pós)
Total: 9 (6 permissivas + 3 restritivas).
Restritivas:
- `nsec12_opportunities_insert_block_viewer` — SEC-013 RESOLVED
- `nsec12_opportunities_insert_tenant_relations_guard` — SEC-014, SEC-015 RESOLVED
- `nsec12_opportunities_insert_account_contact_tenant_guard` — SEC-016, SEC-017 RESOLVED

## 5. Estado da RPC pré
`public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text)`:
- `prosecdef=false` (SECURITY INVOKER)
- `search_path=public`
- EXECUTE concedido a authenticated (herança padrão anon/service_role no ACL, mas sem `auth.uid()` válido não passa da whitelist)
- Whitelist rígida de fixtures sintéticas
- Rollback interno via `RAISE EXCEPTION 'NSEC12_ROLLBACK'`
- Contato órfão rejeitado com `REJECTED_ORPHAN_CONTACT`

## 6. Fixtures
| Entidade | Org A | Org B |
|---|---|---|
| Organization | `e1c4881f-0cd4-45fb-bc50-48314ce7bca0` | `bea090a6-4c6c-45b1-92e0-83678c687578` |
| Pipeline | `d1f1c882-6769-49d6-a9ca-9de75aeb30f5` | `0526054f-d41d-485c-b669-6f6235b6f992` |
| Stage | `18208f58-29b3-4e34-99bb-613751659bc7` | `7efae798-823e-4521-a9bc-959ba1551e48` |
| Account | `36085a30-06a1-491a-a079-a24fb42dd92b` | `b777baac-072a-4c1a-b481-306d0c899f41` |
| Contact | `55d589fb-e680-455a-b9d9-987a7c2bbbf0` | `47ad14f0-3e17-4a6e-a268-bdd9f5dc8a27` |

## 7. Exclusão do órfão
Contato órfão `b53de59c-c80d-451c-9a2b-d9423d50fcb3` verificado presente e inalterado; nunca utilizado nos probes.

## 8. Metodologia
JWTs reais emitidos via `nsec12-provision-fixtures/issueToken` (uma call por persona). Cada probe:
- `apikey`: publishable key
- `Authorization`: Bearer `<jwt-persona>` (nunca service role)
- Payload da RPC com `p_organization_id`, `p_pipeline_id`, `p_stage_id`, `p_account_id`, `p_contact_id`, `p_title`
- Título: `SECURITY_TEST_OPPORTUNITY_REL_CANARY_MATRIX_CHG021_<tag>_<ROLE>_<CENÁRIO>`
- Rollback interno da RPC preserva zero persistência.

## 9. Matriz same-org (Bloco 1 — 12 probes)
| # | Persona | Org | Esperado | Observado |
|---|---|---|---|---|
| P1 | Owner A | A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P2 | Admin A | A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P3 | Manager A | A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P4 | Sales A | A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P5 | Viewer A | A | BLOCKED_RLS | BLOCKED_RLS |
| P6 | CS A | A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P7 | Owner B | B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P8 | Admin B | B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P9 | Manager B | B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P10 | Sales B | B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P11 | Viewer B | B | BLOCKED_RLS | BLOCKED_RLS |
| P12 | CS B | B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |

Resultado agregado: **10 permitidos e revertidos + 2 viewers bloqueados** (12/12 conforme esperado).

## 10. Resultado por papel (same-org)
| Papel | Org A | Org B |
|---|---|---|
| owner | PASS | PASS |
| admin | PASS | PASS |
| manager | PASS | PASS |
| sales | PASS | PASS |
| viewer | BLOCKED (esperado) | BLOCKED (esperado) |
| cs | PASS | PASS |

## 11. Matriz account cross-tenant (Bloco 2 — 12 probes)
Payload: `organization_id=<home>`, `account_id=<outro tenant>`, `contact_id=NULL`.

| # | Persona | Home | account_id | Esperado | Observado |
|---|---|---|---|---|---|
| P13 | Owner A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P14 | Admin A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P15 | Manager A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P16 | Sales A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P17 | Viewer A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P18 | CS A | A | Account B | BLOCKED_* | BLOCKED_RLS |
| P19 | Owner B | B | Account A | BLOCKED_* | BLOCKED_RLS |
| P20 | Admin B | B | Account A | BLOCKED_* | BLOCKED_RLS |
| P21 | Manager B | B | Account A | BLOCKED_* | BLOCKED_RLS |
| P22 | Sales B | B | Account A | BLOCKED_* | BLOCKED_RLS |
| P23 | Viewer B | B | Account A | BLOCKED_* | BLOCKED_RLS |
| P24 | CS B | B | Account A | BLOCKED_* | BLOCKED_RLS |

**12/12 bloqueados.** Viewer possui duas barreiras independentes (policy de viewer + tenant guard).

## 12. Matriz contact cross-tenant (Bloco 3 — 12 probes)
Payload: `organization_id=<home>`, `account_id=NULL`, `contact_id=<outro tenant>`.

| # | Persona | Home | contact_id | Esperado | Observado |
|---|---|---|---|---|---|
| P25 | Owner A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P26 | Admin A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P27 | Manager A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P28 | Sales A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P29 | Viewer A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P30 | CS A | A | Contact B | BLOCKED_* | BLOCKED_RLS |
| P31 | Owner B | B | Contact A | BLOCKED_* | BLOCKED_RLS |
| P32 | Admin B | B | Contact A | BLOCKED_* | BLOCKED_RLS |
| P33 | Manager B | B | Contact A | BLOCKED_* | BLOCKED_RLS |
| P34 | Sales B | B | Contact A | BLOCKED_* | BLOCKED_RLS |
| P35 | Viewer B | B | Contact A | BLOCKED_* | BLOCKED_RLS |
| P36 | CS B | B | Contact A | BLOCKED_* | BLOCKED_RLS |

**12/12 bloqueados.**

## 13. Baseline pré/pós
| Métrica | Pré | Pós |
|---|---|---|
| opportunities totais | 2624 | 2624 |
| opportunities `SECURITY_TEST_OPPORTUNITY_REL_%` | 0 | 0 |
| opportunities `SECURITY_TEST_%` | 0 | 0 |
| accounts sintéticas A/B | 2 | 2 |
| contacts oficiais A/B | 2 | 2 |
| contato órfão | 1 (inalterado) | 1 (inalterado) |
| pipelines/stages sintéticos | 2/2 | 2/2 |
| policies em opportunities | 9 | 9 |

Zero opportunity persistida, zero efeito derivado sintético.

## 14. Concorrência real
Contagens globais coincidem pré/pós porque a janela foi curta e sem escrita externa relevante. Validação primária baseada em títulos sintéticos e IDs exatos (zero persistência), imune a variação global.

## 15. Smoke read-only
Não executado UI-driven neste turno (mudança AMARELA sem impacto em telas). As policies e o dataset real permanecem inalterados; frontend não foi tocado. Grep confirma zero referência à RPC em produto (`src/`, `supabase/functions/`). O único match remanescente é `src/integrations/supabase/types.ts` (auto-gerado, será reciclado no próximo type-sync) e a migração histórica de criação.

## 16. Cleanup da RPC
Migration aplicada:
```
REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text)
  FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text);
```

Verificações pós:
- `pg_proc` retorna 0 para o nome (`SELECT COUNT(*) FROM pg_proc WHERE proname='nsec12_probe_insert_opportunity_with_relations'` = 0).
- Zero grant residual (função inexistente).
- Zero referência em `src/` e `supabase/functions/` de produto.
- 9 policies e todos os triggers de `opportunities` intactos.
- Fixtures ativas.
- Órfão inalterado.

## 17. Findings
| ID | Status pré | Status pós |
|---|---|---|
| SEC-013 | RESOLVED | RESOLVED (revalidado — viewers bloqueados P5/P11) |
| SEC-014 | RESOLVED | RESOLVED |
| SEC-015 | RESOLVED | RESOLVED |
| SEC-016 | RESOLVED (CHG-020) | RESOLVED (matriz por papel homologada) |
| SEC-017 | RESOLVED (CHG-020) | RESOLVED (matriz por papel homologada) |

## 18. Dados reais intocados
- Zero opportunity, account, contact, pipeline ou stage real modificado.
- Zero egress externo.
- Zero JWT ou secret em log.
- Toda escrita síncrona da RPC foi revertida pelo rollback interno; drop da RPC removeu qualquer possibilidade futura de reuso.

## 19. Risco residual
- Compatibilidade `opportunities.account_id ↔ contacts.account_id` same-tenant **NÃO EXECUTADA** (falta fixture de incompatibilidade same-tenant).
- **UPDATE** em opportunities **NÃO EXECUTADO** nesta janela.
- **DELETE** em opportunities **NÃO EXECUTADO** nesta janela.

## 20. Decisão final
**OPPORTUNITIES ACCOUNT/CONTACT TENANT MATRIX HOMOLOGADA**
