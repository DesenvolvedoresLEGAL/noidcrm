## Diagnóstico — por que aparece "0 / Nenhuma proposta"

A tela `Win/Loss Hub → Aprovações` carrega o hook `useProposalApprovalsHistory`, que faz:

```ts
.in('status', ['accepted', 'declined', 'expired'])
```

Mas no banco, os status reais da tabela `proposals` são:

```
draft | sent | accepted | rejected
```

Ou seja:
- **`declined` não existe** → o filtro elimina TODAS as 8 propostas recusadas (incluindo as que acabaram de ser sincronizadas pelo gatilho de oportunidade perdida).
- **`expired` também não existe como status** — propostas vencidas continuam com `status='sent'` e apenas `expires_at < now()`.

Resultado: mesmo com 147 aceitas + 6 recusadas no banco, a aba sempre mostra 0.

## O que vou fazer (100% frontend)

### 1. Corrigir o hook `src/hooks/useProposalApprovalsHistory.ts`
- Trocar o filtro para `status IN ('accepted','rejected')` + uma busca paralela de "expiradas" = `status='sent' AND expires_at < now() AND expires_at >= from`.
- Normalizar `rejected → 'declined'` no retorno (a UI já trabalha com esse termo) **ou** ajustar a UI para `rejected`. Vou normalizar para `declined` — menor impacto.
- Manter o filtro de janela por data (`accepted_at`/`declined_at`/`expires_at`) e o cruzamento com `pipeline_type='sales'`.

### 2. Renomear menu e título
- `WinLossHub.tsx` linha 254: `Aprovações` → `Relatório`.
- `ProposalApprovalsTab.tsx` título do card: `Aprovações & Reprovações de Propostas` → `Relatório de Decisões de Propostas`.
- Manter o ícone `FileCheck` (ou trocar por `FileText`, mais coerente).
- Manter `value="approvals"` da Tabs (chave interna) para não quebrar deep links — só o label muda.

### 3. Transformar em verdadeiro relatório acionável
Adicionar logo abaixo dos contadores 3 modos de visualização (segmented):

```text
[ Lista ]  [ Por Cliente ]  [ Por Vendedor ]
```

- **Lista** → comportamento atual (cards individuais com motivo, feedback, IP, etc.).
- **Por Cliente** → agrupa por `account.nome_fantasia ?? razao_social`, exibindo:
  - total de propostas, aceitas, recusadas, expiradas
  - valor aprovado vs perdido
  - lista expansível com o motivo de cada decisão
- **Por Vendedor** → mesma estrutura agrupada por `owner_name`, com taxa de aprovação (`accepted / (accepted + declined)`).

Ambos os agrupamentos reusam o mesmo dataset já carregado — sem chamadas extras ao banco.

### 4. Trazer o nome do cliente para o relatório
O hook já carrega `opportunity` mas não a `account`. Vou estender o `select` para também trazer:

```ts
opportunity:opportunities!inner(
  id, title, valor_previsto, pipeline_id, owner_user_id, organization_id,
  account:accounts(id, nome_fantasia, razao_social, name)
)
```

E adicionar `account_id`, `account_name` ao tipo `ProposalApprovalEntry` — usado nos cards e no agrupamento "Por Cliente".

### 5. Exportar CSV completo
Adicionar coluna `Cliente` no CSV (já existe `Vendedor`). Continua exportando o filtro corrente.

## Arquivos impactados

- `src/hooks/useProposalApprovalsHistory.ts` — fix do filtro de status, segunda query para expiradas, enriquecimento com `account`.
- `src/components/intelligence/winloss/tabs/ProposalApprovalsTab.tsx` — renomear título, adicionar segmented control de modo, renderizadores `GroupedByAccount` e `GroupedBySeller`, coluna `Cliente` no CSV, mostrar nome do cliente em cada card.
- `src/pages/intelligence/WinLossHub.tsx` — label `Aprovações` → `Relatório`.

## Riscos

- **Baixo**. Sem mudanças de schema, RLS, edge functions ou tipos do Supabase. Mantemos a chave `value="approvals"` para não quebrar deep links.
- O label "expired" continua sendo derivado em runtime (não é um status persistido) — assumido como aceitável para um relatório.

## Critério de sucesso

1. Após o fix, a aba **Relatório** com filtro "Ano" deve mostrar **147 Aprovadas + 6 Recusadas** (números atuais do banco) — o usuário hoje vê 0/0.
2. Cada card exibe o nome do cliente (`nome_fantasia` quando houver).
3. O modo "Por Cliente" mostra cada conta como um bloco com contadores e valor aprovado/perdido.
4. O modo "Por Vendedor" mostra a taxa de aprovação por vendedor.
5. Menu lateral e título passam a chamar **Relatório**.
