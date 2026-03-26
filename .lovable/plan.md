

## Problema

No bloco "Proposta" (card roxo), tanto no link público quanto no PDF, aparece o `proposal.title` (ex: "Proposta Comercial - PONTOBR EVENTOS LTDA"). O usuário quer que ali apareça o **título da oportunidade** (ex: "POSITIVO NA BETT BRASIL 2026").

## Alterações

### 1. Link público — `src/pages/ProposalPublicView.tsx`

**Linha ~1139** — Trocar:
```tsx
<p className="font-semibold">{proposal.title || 'Proposta Comercial'}</p>
```
por:
```tsx
<p className="font-semibold">{proposal.opportunity?.title || proposal.title || 'Proposta Comercial'}</p>
```

### 2. PDF — `supabase/functions/generate-proposal-pdf/index.ts`

**Linha ~609** — No campo "Título" do HTML gerado, trocar:
```ts
<span class="info-value">${proposal.title || 'Sem título'}</span>
```
por:
```ts
<span class="info-value">${proposal.opportunity?.title || proposal.title || 'Sem título'}</span>
```

Duas mudanças simples, sem impacto em nenhum outro fluxo.

