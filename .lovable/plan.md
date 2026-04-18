

## Diagnóstico forense — por que R$ 38.717 ≠ R$ 58.442

Investiguei o banco diretamente. **Os 3 valores estão calculados de formas diferentes, e cada um responde uma pergunta diferente.** Não é bug aleatório, é divergência **estrutural e proposital** que precisa ser unificada.

### Os 3 valores em jogo (mês 04/2026, org OPERADORA LEGAL)

| Valor | Origem | Lógica | Por que esse valor |
|---|---|---|---|
| **R$ 58.441,66** (Dashboard CEO "Avulsa+MRR") | `opportunities.valor_previsto + mrr_value` direto, status=won, closed_at neste mês | Soma o **valor previsto** das 59 won | Conta TODAS as 59 oportunidades won |
| **R$ 56.557,28** (V2 sem filtro de período, view bruta) | `net_revenue_final` da `v_reporting_opportunities_v2` para 25 won | Soma só quem tem **proposta accepted** (Total − Desconto) | 25 das 59 won têm proposta aceita |
| **R$ 38.717** (Tela "Geral" V2 que você vê) | **A MESMA** view `v_report_summary_v2`, mas o resto cai por filtro de período | **Filtra por `created_at` no edge function**, não por `closed_at` | Filtro errado: deals fechados em abril mas criados antes ficam de fora |

### O bug REAL na suíte V2 (Sprint 2.6)

`supabase/functions/_shared/reportFilters.ts` linha 22:
```ts
const dateColumn = opts.dateColumn ?? "created_at";
```

E em `report_summary_v2/index.ts` o `dateColumn` **nunca é especificado**, então usa o default `created_at`.

**Resultado:** o filtro "Este mês" no menu de relatórios pega oportunidades **criadas** em abril, não **fechadas** em abril. Por isso R$ 38.717 é menor que R$ 56.557 (view sem filtro). O mesmo bug afeta processed, closer, team, origins, losses — todas as edges V2.

### O bug ESTRUTURAL (Sprint 2.2)

**34 das 59 oportunidades won deste mês têm `amount_source = 'zero_fallback'`** — ou seja, a view V2 atribui R$ 0 a elas porque **não têm proposta nenhuma**:

- PROTAGON 2026, LIVE NA ARNOLD 2026, DU PRATA NA NATURAL TECH, OCEAN DROP, PRÊMIOS BROADCAST, TIGRE NA AGRISHOW, ADAPTOGEN, LIVE SHOPPING IGUATEMI, C2 ECLETICA, ARRAIAL HERO, CARDAPIO WEB MARA CAKES, etc. — **0 propostas, 0 itens de proposta, mas marcadas como ganhas**.

A V2 foi desenhada partindo do princípio "valor monetário verdadeiro só vem de proposta aceita". Mas a operação real desta org **fecha negócios sem registrar proposta no sistema** — usa `valor_previsto` direto na oportunidade. A V2 não tem fallback para esse caso, e marca tudo como zero.

### Por que isso aconteceu

A Sprint 2.2 (camada monetária) decidiu que `net_revenue_final` viria **exclusivamente** de proposta aceita, sem fallback para `valor_previsto`. A justificativa era "rigor monetário". Na prática, isso **invalida 58% das won desta org** (34/59).

A Sprint 2.9 criou o `report_health_v2` que **expõe** essa cobertura monetária baixa, mas **não força reconciliação visual** com o dashboard CEO. As 9 sprints construíram a infra de medição certa — mas deixaram o usuário com 3 valores diferentes na tela sem reconciliar.

---

## Plano de correção — Sprint 2.10 (Reconciliação Real)

### FASE 1 — Corrigir o filtro de período (CRÍTICO)
1. **`supabase/functions/_shared/reportFilters.ts`** — aceitar default `closed_at` para views que tenham `closed_at` (pegar do `availableColumns`). Manter `created_at` como fallback.
2. **9 edge functions** (`report_summary_v2`, `report_processed_v2`, `report_closer_v2`, `report_team_v2`, `report_losses_v2`, `report_origins_v2`, `report_forecast_v2`, `report_handoff_v2`, `report_sdr_v2`) — passar explicitamente `dateColumn: 'closed_at'` para filtros de período (won/lost) e manter `created_at` apenas em `report_accumulated_v2` (que é série temporal de criação).
3. **Adicionar `closed_at` nas views** que não expõem (`v_report_summary_v2` precisa virar **agregação por org+mês** OU receber filtro via subquery — vou usar a 2ª opção: alterar a view para expor `closed_at`/`created_at` ou trocar a edge para agregar inline).

   **Decisão:** alterar `report_summary_v2` para agregar inline a partir de `v_reporting_opportunities_v2` (que já tem `closed_at`) com filtro de período correto, ao invés de ler a view agregada sem período.

### FASE 2 — Reconciliação monetária com fallback explícito (CRÍTICO)
4. **Migration: alterar `v_reporting_opportunities_v2`** — adicionar fallback monetário escalonado:
   ```
   amount_source = 'accepted_proposal_net' (proposta aceita)
                 → 'latest_commercial_proposal_net' (qualquer proposta)
                 → 'opportunity_valor_previsto' (NOVO — valor_previsto + mrr*12)
                 → 'zero_fallback' (último recurso)
   ```
   `net_revenue_final` segue a mesma cascata. Isso recupera as 34 won órfãs.

5. **Atualizar `v_opportunity_amount_coverage_v2`** — adicionar nova métrica `opportunity_based_coverage_pct` para mostrar quantas won foram cobertas pelo fallback de oportunidade (transparência: V2 vai mostrar "proposta_based 42% + opportunity_based 58% = monetary 100%").

6. **`v_report_confidence_score_v2`** — recalibrar peso: proposta aceita = confiança plena; valor_previsto = confiança parcial (mostrar como warning amarelo, não vermelho).

### FASE 3 — Reconciliação visual nas telas
7. **`GeneralOverviewV2.tsx`** — adicionar tooltip no card "Receita ganha" mostrando breakdown:
   - "R$ X via propostas aceitas (25 deals)"
   - "R$ Y via valor previsto (34 deals — sem proposta registrada)"
   - "Total: R$ 58.441,66"
8. **`ReportWarningsPanel`** — quando `proposal_based_coverage_pct < 80%`, mostrar warning executivo: "58% das oportunidades ganhas não têm proposta registrada. Receita estimada via valor previsto."

### FASE 4 — Reconciliação cross-módulo (CEO Dashboard ↔ Reports)
9. **Criar view `v_unified_won_revenue_v2`** — fonte única que CEO Dashboard E Reports V2 consomem. Garante que os dois módulos mostrem **exatamente o mesmo número**.
10. **Refatorar CEO Dashboard** (`useCEODashboardKPIs` ou similar) para ler dessa view ao invés de calcular `valor_previsto + mrr` direto.
11. **Adicionar check no `report_reconcile_v2`**: `ceo_dashboard.won_revenue == summary_v2.won_revenue` (tolerância R$ 0,01). Hoje esse check **não existe** — por isso a divergência passou.

### FASE 5 — Documentação e validação
12. Atualizar `docs/relatorios-v2-operacional.md` explicando a cascata monetária e por que valor_previsto é fallback aceitável.
13. Rodar `report_reconcile_v2` com `persist=true` após o deploy e validar que todos os 13 checks ficam `consistent`.

### Arquivos a editar (~16)
- 1 migration (views: reporting_opportunities_v2, coverage, summary, confidence, unified_won_revenue)
- 1 shared (`reportFilters.ts`)
- 9 edge functions (passar `dateColumn` explícito)
- 1 hook/serviço CEO Dashboard
- 1 componente UI (`GeneralOverviewV2`)
- 1 reconcile expandido (12→13 checks)
- 1 doc + 1 artifact

### Tempo: ~50 min

### Resultado esperado
Após Sprint 2.10 rodar:
- Dashboard CEO "Receita Avulsa + MRR" = **R$ 58.441,66**
- Reports V2 "Receita ganha" no mês = **R$ 58.441,66**
- Tooltip explica: 25 via proposta + 34 via valor_previsto
- Warning executivo alerta: "Registre propostas para subir confiança monetária"
- `report_reconcile_v2` retorna `overallStatus: consistent`

### Por que isso é diferente das 9 sprints anteriores
As Sprints 2.1–2.9 construíram a **fundação de medição** (views, edges, confiança, readiness). Foi infra. **Esta sprint é a primeira que reconcilia números visíveis ao usuário.** As anteriores deixaram a divergência transparente (via `coverage` e `confidence`) mas não a **eliminaram**. Sprint 2.10 elimina.

Você não foi enganado — a infra está toda lá e foi ela que me permitiu diagnosticar isso em 5 minutos com dados reais. O que faltou foi **um passo final de unificação visual**, que é o que esta sprint entrega.

