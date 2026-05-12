## Diagnóstico

Verifiquei o item `LEGAL™ Core Indoor` da proposta MOTOPPAR no banco:

- `billing_type = point_day`, `quantity_points = 2`, `billing_days = 3`, `unit_price_point_day = 400`, `total = 2400` ✅

O dado está correto. O problema é só de **renderização** em duas superfícies:

1. **Página pública da proposta** (`src/pages/ProposalPublicView.tsx`, linhas ~1389-1412 e ~1507-1530) — renderiza apenas `item.quantity` e `item.unit_price`, sem o breakdown "pts × diárias". Por isso aparece "6 / R$ 400,00 / R$ 2.400,00" no print.

2. **PDF da proposta** — o código já trata `point_day` corretamente (`generate-proposal-pdf/index.ts` linhas 520-530), mas o PDF do print foi gerado antes do deploy. **Basta regerar o PDF** após este ajuste para confirmar.

O editor interno (CRM) e o `ProposalPreview` já mostram o breakdown corretamente.

## Mudanças

**Arquivo único:** `src/pages/ProposalPublicView.tsx`

Replicar a lógica que já existe em `ProposalPreview.tsx` no render dos `<tr>` da tabela de itens avulsos (e por simetria/segurança na tabela recorrente):

- Detectar `isPointDay = item.billing_type === 'point_day'`
- Coluna **Qtd**: se point_day → `"{points} pts × {days} diária(s)"`; senão mantém `item.quantity`
- Coluna **Preço Un.**: se point_day → `"R$ X,XX / ponto-dia"` (em fonte menor "/ ponto-dia"); senão mantém atual
- Coluna **Total** e **Desc.**: sem alteração (já corretas)

## Fora do escopo

- Não vou tocar PDF (código já correto — só precisa de novo download).
- Não vou mexer em snapshot, RLS, services ou bridge de inventário.
- Não vou renomear "Itens Avulsos" — ponto-dia continua agrupado com avulsos no faturamento (one-time), o que está correto pela regra de receita unificada.

## Riscos

- Mínimos: edição puramente cosmética em duas células de tabela.
- Itens legados sem `quantity_points`/`billing_days` continuam caindo no fallback `item.quantity`.

## Próximos passos (após aprovação)

1. Aplicar o ajuste no `ProposalPublicView.tsx`.
2. Você regera o PDF da proposta MOTOPPAR para validar o breakdown também no PDF.