
## Correção: Data de Vencimento MRR mostrando dia 10 ao invés do dia 05

### Problema Identificado

O banco de dados salva o dia de vencimento corretamente em **`billing_day: 5`**, mas existem campos legados (`recurring_due_day`) que mantêm o valor padrão antigo = 10.

O código de visualização pública e geração de PDF está priorizando o campo **legado** (`recurring_due_day = 10`) em vez do campo **correto** (`billing_day = 5`).

**Dados no banco para sua proposta:**
```
billing_day: 5          ✅ Correto (você configurou)
recurring_due_day: 10   ❌ Campo legado (não deveria ser usado)
contract_start_date: 2026-02-05  ✅ Correto
```

### Causa Raiz

A ordem de prioridade dos campos está **invertida** em 3 lugares:

| Arquivo | Linha | Código Atual (ERRADO) | Código Correto |
|---------|-------|----------------------|----------------|
| `ProposalPublicView.tsx` | 264 | `recurring_due_day \|\| billing_day \|\| 10` | `billing_day \|\| recurring_due_day \|\| 10` |
| `ProposalPublicView.tsx` | 1429 | `recurring_due_day \|\| billing_day \|\| 10` | `billing_day \|\| recurring_due_day \|\| 10` |
| `proposalPdfBuilder.ts` | 193 | `recurring_due_day \|\| billing_day \|\| 10` | `billing_day \|\| recurring_due_day \|\| 10` |

### Arquivos a Modificar

#### 1. `src/pages/ProposalPublicView.tsx`

**Linha 264** - Função `handleDownloadPDF`:
```typescript
// ANTES (errado):
billing_day: recurringTerm.recurring_due_day || recurringTerm.billing_day || 10,

// DEPOIS (correto):
billing_day: recurringTerm.billing_day || recurringTerm.recurring_due_day || 10,
```

**Linha 1429** - Renderização do cronograma MRR:
```typescript
// ANTES (errado):
const billingDay = recurringTerm.recurring_due_day || recurringTerm.billing_day || 10;

// DEPOIS (correto):
const billingDay = recurringTerm.billing_day || recurringTerm.recurring_due_day || 10;
```

#### 2. `src/lib/proposalPdfBuilder.ts`

**Linha 193** - Função `buildProposalPDFData`:
```typescript
// ANTES (errado):
billing_day: (recurringTerm as any).recurring_due_day || recurringTerm.billing_day || 10,

// DEPOIS (correto):
billing_day: recurringTerm.billing_day || (recurringTerm as any).recurring_due_day || 10,
```

### Resultado Esperado

Após a correção:
- O link rápido mostrará as cobranças MRR no dia **05** (como configurado)
- O PDF gerado mostrará as datas de vencimento no dia **05**
- O campo `billing_day` sempre terá prioridade sobre o campo legado `recurring_due_day`

### Nota Técnica

A Edge Function `generate-proposal-pdf` já usa a ordem correta (`billing_day || recurring_due_day`), então não precisa ser alterada. Apenas o código frontend precisa de correção.
