# OTE — Transparência total de cálculo de comissão

## Objetivo
Garantir auditabilidade completa do módulo OTE: cada real de variável precisa ter rastro até a venda (ou lead qualificado) que originou. Hoje o botão "Excel" não faz nada e a aba "Por Vendedor" não mostra a lista de vendas/leads que compõem o resultado.

## Escopo desta entrega
1. Exportação real para Excel (.xlsx) com abas detalhadas por vendedor.
2. Drill-down detalhado na aba "Por Vendedor" mostrando cada venda ou cada lead qualificado.
3. Marcação transparente de itens que NÃO contam para a meta (produtos/serviços fora da meta), tanto na tela quanto no Excel.
4. Aba "Histórico" — sem alterações nesta entrega (validar com usuário se quiser refinar depois).

## O que será construído

### 1. Drill-down "Por Vendedor" (tela)
Dentro de cada card expansível do vendedor, adicionar uma seção nova: **"Vendas que compuseram a meta"** (Closers) ou **"Leads qualificados"** (Pré-vendas/SDR).

Para **Closers (revenue)** — tabela com:
- Nº da proposta / Oportunidade
- Cliente
- Data e hora de fechamento (`closed_at`)
- Pipeline / Etapa
- Valor comercial aprovado (fonte: `commercial_won_revenue_view` — Source of Truth)
- Tipo (MRR, One-shot, Misto)
- Conta para meta? (Sim / Não) — com motivo quando "Não" (ex.: produto marcado como `excluded_from_goal`, pipeline operacional, etc.)
- Subtotal "elegível para meta" vs "não elegível"

Para **Pré-vendas (leads)** — tabela com:
- Oportunidade
- Cliente
- Data e hora de qualificação (`closed_at` da oportunidade no pipeline de qualificação)
- Pipeline de qualificação
- Próximo destino (handoff)
- Conta para meta? (Sim / Não)

Cada linha permite abrir a oportunidade/proposta original em nova aba.

### 2. Exportação Excel
Substituir o stub atual (`handleExportExcel` em `src/pages/OTEReport.tsx`) por geração real de `.xlsx` via `xlsx`/`exceljs` (lib já leve, client-side).

Estrutura do arquivo `OTE_<periodo>.xlsx`:
- **Aba 1 — Resumo geral**: KPIs do período (Total a pagar, Vendas, Média % Meta, contagem por flag).
- **Aba 2 — Closers consolidado**: uma linha por vendedor com Meta, Vendas, % Meta, Multiplicador, Base, Aceleradores, Desaceleradores, Variável Final, Flag, Status.
- **Aba 3 — Pré-vendas consolidado**: análogo, com Meta em leads.
- **Aba 4 — Detalhe de vendas (Closers)**: uma linha por venda (todas as vendas de todos os closers no período), incluindo a coluna `Conta para meta?` e motivo.
- **Aba 5 — Detalhe de qualificações (SDRs)**: uma linha por lead qualificado, com data/hora.
- **Aba 6 — Aceleradores/Desaceleradores**: por vendedor, mostrando Roleplay, CRM, FitScore, ajustes finais.

Cabeçalho de cada aba com período, data/hora de geração, organização e quem exportou — para servir como prova de auditoria.

### 3. Backend — fonte de verdade para o detalhe

Hoje `ote_sales_records` é populado pela edge `calculate-ote`, mas:
- usa `commission_value ?? valor_previsto` (legado), divergindo da SSoT (`commercial_won_revenue_view`)
- grava `sale_date = hoje` em vez do `closed_at` real
- não armazena MRR vs one-shot, nem flag de "não conta para meta"

Ajustes mínimos:
- Em `calculate-ote`, ao gravar `ote_sales_records`:
  - usar `closed_at` como `sale_date`
  - cruzar com `commercial_won_revenue_view` para pegar `commercial_amount`, `mrr_amount`, `one_shot_amount`, `revenue_confidence`
  - adicionar colunas novas em `ote_sales_records`: `mrr_amount numeric`, `one_shot_amount numeric`, `counts_toward_goal boolean default true`, `exclusion_reason text`, `closed_at timestamptz`, `pipeline_id uuid`
- Para SDR (`goal_type='leads'`): hoje não persiste registros. Passar a gravar uma linha por oportunidade qualificada (mesma tabela `ote_sales_records`, com `sale_value=0`, `closed_at`, `counts_toward_goal`).
- Criar hook `useOTESalesRecords(periodMonth, userId?)` para alimentar a UI e o Excel.

Regras de exclusão de meta consideradas:
- Pipeline operacional/onboarding (já é filtrado pela edge — manter, mas mostrar como transparência se aparecer)
- Itens de proposta marcados como `excluded_from_goal` (se a flag existir no produto — confirmar; caso contrário, deixar a coluna preparada e marcar todos como "Sim" por enquanto).

## Detalhes técnicos

```text
src/
  pages/OTEReport.tsx                    -> handleExportExcel real
  components/ote/
    OTESellerDetailTab.tsx               -> nova seção drill-down
    OTESellerSalesDrilldown.tsx (novo)   -> tabela de vendas/leads
    export/buildOTEWorkbook.ts (novo)    -> monta o .xlsx
  hooks/
    useOTESalesRecords.ts (novo)         -> lê ote_sales_records + join commercial_won_revenue_view

supabase/
  functions/calculate-ote/index.ts       -> grava detalhe correto (SSoT + leads + counts_toward_goal)
  migrations/...                         -> ALTER TABLE ote_sales_records add columns
```

Libs:
- Usar `xlsx` (SheetJS) — leve, client-side, sem dependência server. Já existe skill xlsx para padrões, mas a exportação aqui é client-side simples (não precisa LibreOffice).

## Riscos
- Recalcular OTE depois da migration é necessário para popular as colunas novas; até lá o Excel mostra os campos legados.
- `commercial_won_revenue_view` é a SSoT; qualquer divergência entre ela e `ote_sales_records` deve ser logada como warning na coluna "Confiança".
- RLS: garantir que `ote_sales_records` continua filtrando por organização e respeitando visibilidade (Closer vê só o próprio detalhe; gestor/admin vê todos).

## Fora de escopo
- Refinamento da aba "Histórico".
- Mudança nas regras de cálculo de aceleradores/desaceleradores.
- Workflow de aprovação/pagamento de comissão.

## Próximos passos
1. Aprovar este plano.
2. Migration em `ote_sales_records` (colunas novas).
3. Atualizar `calculate-ote` para popular detalhe completo (Closers + SDRs).
4. Hook `useOTESalesRecords` + drill-down na UI.
5. Geração real do `.xlsx` no botão Excel.
6. Pedir ao usuário para clicar em "Calcular" no período desejado e validar.
