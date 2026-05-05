## Diagnóstico

### Problema 1 — PDF "engole" um item (LEGAL™ Core sumiu)
**Causa raiz em `src/lib/proposalPdfGenerator.ts` (renderItemsTable, linhas ~590‑650).**

O fluxo atual faz:
1. `didParseCell` zera o texto da célula (`data.cell.text = ['']`) para desenhar manualmente nome+descrição.
2. `willDrawCell` recalcula `data.cell.height` **depois** que o autoTable já planejou o layout.
3. `didDrawCell` desenha o conteúdo via `doc.text(...)`.

Com `rowPageBreak: 'avoid'` e a célula reportando altura ~0 na fase de planejamento, o autoTable acha que a linha cabe; quando `willDrawCell` infla a altura no draw, a linha estoura a página e o jsPDF **descarta o desenho** dessa linha (fica em branco / é "comida"). É exatamente o que aconteceu com o item Core (que tem a descrição mais longa). Os totais permanecem corretos porque são calculados a partir do array `items`, não do que foi efetivamente desenhado — daí a inconsistência (soma visível ≠ Total).

### Problema 2 — Cargo, telefone e e‑mail do contato sumindo no PDF
**Causa raiz na ponte `buildProposalPDFData` → `generateProposalPDFClient`.**

- `buildProposalPDFData` (`src/lib/proposalPdfBuilder.ts`) preenche os campos **flat** `contact_name`, `contact_email`, `contact_phone`, mas **não** popula `pdfData.opportunity.contact` nem inclui `cargo`.
- Em `proposalPdfGenerator.ts` (linhas 393‑421) o card de Contato lê:
  - `proposal.contact_name || proposal.opportunity?.contact?.nome` (ok)
  - `proposal.opportunity.contact.cargo` (**sempre undefined** vindo do builder → cargo nunca aparece)
  - `proposal.contact_email || extractEmail(proposal.opportunity?.contact?.emails)` (depende do flat)
  - `proposal.contact_phone || extractPhone(proposal.opportunity?.contact?.telefones)` (depende do flat)
- O builder extrai `value` do JSONB, mas o schema real grava `email`/`numero` em alguns casos (vide `extractEmail`/`extractPhone` em `src/lib/contactFormat.ts` que tratam `email|value|address` e `numero|phone|value|number`). Quando o objeto vem com `email`/`numero`, `contact_email`/`contact_phone` ficam vazios → e como o fallback `opportunity.contact` também está ausente, **não aparece nada**.

Mesmo problema atinge o link rápido quando o PDF é baixado pela `ProposalPublicView`.

---

## Plano de Correção

### Frente A — Eliminar o "item engolido" no PDF
Em `src/lib/proposalPdfGenerator.ts` (`renderItemsTable`):
1. **Pré-calcular a altura de cada linha** (nome + descrição) ANTES do autoTable, e passá-la como `minCellHeight` no `body` row config (`{ content, styles: { minCellHeight } }`).
2. Remover a mutação tardia de `data.cell.height` em `willDrawCell` (mantendo apenas o desenho em `didDrawCell`).
3. Manter `rowPageBreak: 'avoid'` — agora seguro porque o autoTable já conhece a altura real e fará o page-break corretamente.

Resultado: nenhum item é descartado e a soma visível dos itens passa a bater com o Total.

### Frente B — Garantir cargo / telefone / e‑mail do contato
1. Em `src/lib/proposalPdfBuilder.ts`:
   - Adicionar `cargo` ao tipo `ProposalPDFData` (campo flat `contact_cargo`).
   - Trocar a extração inline de e‑mail/telefone pelos helpers `extractEmail` / `extractPhone` de `@/lib/contactFormat` (cobrem `value|email|numero|phone|address`).
   - Popular `contact_cargo: contact?.cargo || ''`.
2. Em `src/lib/proposalPdfGenerator.ts`:
   - No card de Contato, ler `proposal.contact_cargo || proposal.opportunity?.contact?.cargo` (linha ~400) e usar os mesmos helpers para email/telefone caso `contact_email`/`contact_phone` venham vazios.
   - Adicionar `contact_cargo?: string` à interface `ProposalData`.

### Frente C — Validação visual (sem alterar produto)
- Após a edição, gerar localmente um PDF de teste com a mesma proposta (PROP-2026-00663) e verificar:
  - Os 4 itens aparecem (Setup, Core, Implantação, Logística).
  - Soma dos totais por linha = R$ 11.854,00.
  - Card "Contato" mostra Nome, Cargo, Telefone e E‑mail.

---

## Arquivos a alterar
- `src/lib/proposalPdfGenerator.ts` (render de itens + leitura de cargo/contato)
- `src/lib/proposalPdfBuilder.ts` (campo `contact_cargo` + helpers de extração)

## Riscos
- Mudança de altura via `minCellHeight` pode reduzir levemente a densidade visual em propostas longas (aceitável — preferível a perder linhas).
- Nenhum impacto em backend, RLS, edge functions ou link público (HTML do `generate-proposal-pdf` usa caminho próprio e já estava correto para contato; só o PDF client-side é afetado).

## Próximos passos
Aprovar para eu aplicar as duas frentes em sequência.