

## Problema

Na seção de Pagamento Recorrente (link público e PDF), são exibidos 3 blocos: **MRR**, **Contrato (12m)** e **ARR**. O cliente não precisa saber o que é MRR/ARR — precisa saber apenas **valor mensal** e **total do contrato** (baseado no prazo real, não 12 meses fixos).

## Alterações

### 1. Link público — `src/pages/ProposalPublicView.tsx` (linhas ~1409-1425)

Substituir o grid de 3 colunas (MRR / Contrato 12m / ARR) por **2 colunas**:
- **Valor Mensal**: `R$ X/mês`
- **Total do Contrato (Xm)**: valor mensal × prazo do contrato

Também renomear o título "Pagamento Recorrente (MRR)" → **"Pagamento Recorrente"** (linha ~1352).

### 2. Edge function PDF — `supabase/functions/generate-proposal-pdf/index.ts` (linhas ~758-772)

Mesmo ajuste: remover bloco MRR e ARR, deixar apenas:
- **Valor Mensal**
- **Total do Contrato (Xm)**

Renomear título "Pagamento Recorrente (MRR)" → **"Pagamento Recorrente"** (linha ~750).

### 3. jsPDF fallback — `src/lib/proposalPdfGenerator.ts` (linhas ~714, 736-764)

Mesmo ajuste: substituir os 3 blocos (MRR/Contrato/ARR) por 2 (Valor Mensal / Total do Contrato). Renomear título.

### Resumo das mudanças

| Arquivo | O que muda |
|---------|-----------|
| `ProposalPublicView.tsx` | Grid 3→2 cols, remover MRR/ARR labels, renomear título |
| `generate-proposal-pdf/index.ts` | Grid 3→2 cols, remover MRR/ARR labels, renomear título |
| `proposalPdfGenerator.ts` | Box 3→2 cols, remover MRR/ARR labels, renomear título |

