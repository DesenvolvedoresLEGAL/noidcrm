## Diagnóstico encontrado

A divergência não é só visual. A cadeia financeira da proposta está usando fontes diferentes em momentos diferentes:

- **Itens/base da proposta:** `proposal_items` soma R$ 1.994,00 no caso Lactalis.
- **Tabela dinâmica:** aplica faixa e chega a R$ 2.991,00 ou R$ 2.592,20 dependendo da data/faixa.
- **Desconto comercial:** existe em `proposal_payment_terms.discount_percent`, mas há múltiplas linhas duplicadas para a mesma proposta, algumas com `15%` e outras com `0%`.
- **Orquestração atual:** em alguns pontos pega uma única condição de pagamento por `updated_at/created_at`; quando a linha “errada” é a mais recente, o desconto some.
- **Slack/ERP:** já tentam usar um resolver central, mas esse resolver confia em `approved_amount`/`payment_expected_amount`; se esses campos já foram gravados errados, a notificação e o ERP herdam o erro.
- **Aceite/contrato legado:** ainda há trigger antigo usando `NEW.value`, que pode criar contrato com valor bruto/antigo.

Exemplo Lactalis:
- Base dos itens: **R$ 1.994,00**
- Faixa correta pós-evento: **R$ 2.991,00**
- Desconto comercial: **15%**
- Valor final correto: **R$ 2.542,35**

## Regra canônica proposta

Criar uma única regra de verdade para qualquer saída humana ou integração:

```text
commercial_gross_amount = valor vigente da tabela dinâmica, se aplicável;
                         senão, valor do header/itens.

payment_discount_percent = desconto definido na condição de pagamento avulsa ativa.

approved_net_amount = commercial_gross_amount - desconto comercial.
```

Prioridade de leitura:

1. **Forma e prazo de pagamento ativa** para método, parcelas, datas e desconto.
2. **Tabela dinâmica vigente** para o valor bruto comercial quando a proposta usa precificação automática.
3. **Header da proposta** apenas como fallback quando não houver tabela dinâmica.
4. **Valor líquido final** sempre gravado em `payment_expected_amount` e, no aceite, congelado em `approved_amount`.

## Plano de implementação seguro

### 1. Corrigir duplicidade de condições de pagamento

- Criar uma função/rotina canônica para selecionar a condição avulsa ativa da proposta.
- Não escolher a linha só por `updated_at` quando existem duplicadas conflitantes.
- Consolidar a regra: se houver condição com desconto/manual_schedule/custom_date, ela deve prevalecer sobre linhas padrão criadas automaticamente.
- Ajustar `savePaymentTermsToDb` para sempre substituir corretamente as condições antigas e impedir duplicação de linhas de `one_time` no fluxo normal.

Arquivos impactados:
- `src/pages/ProposalEditor.tsx`
- `src/components/proposals/ProposalEditorModal.tsx` se ainda for usado
- `src/services/supabase/proposal-payment-terms.ts`

### 2. Criar resolver financeiro único no banco

Criar/atualizar uma função SQL canônica, por exemplo:

```text
public.resolve_proposal_commercial_amount(p_proposal_id)
```

Ela retorna:

```json
{
  "gross_amount": 2991,
  "discount_percent": 15,
  "discount_amount": 448.65,
  "net_amount": 2542.35,
  "amount_source": "dynamic_pricing",
  "payment_term_id": "...",
  "pricing_tier_id": "..."
}
```

Essa função será usada por:
- orquestração financeira;
- geração de cobrança;
- aceite;
- Slack;
- ERP;
- sincronização com oportunidade;
- preview/PDF quando precisar exibir total final.

### 3. Ajustar `orchestrate_proposal_financials`

- Parar de calcular desconto manualmente com uma linha aleatória de `proposal_payment_terms`.
- Usar o resolver único.
- Atualizar sempre:
  - `dynamic_pricing_current_amount` = bruto vigente da tabela;
  - `payment_expected_amount` = líquido final;
  - `discount_amount` = desconto monetário real sobre o valor vigente;
  - `opportunities.valor_previsto` = líquido final.

### 4. Congelar valor correto no aceite

No momento em que a proposta for aceita:

- recalcular via resolver financeiro único;
- gravar `approved_amount = net_amount`;
- gravar snapshot de auditoria com bruto, desconto, líquido, parcelas e datas;
- impedir que recalculações futuras alterem o que foi aprovado pelo cliente.

Isso evita Slack/ERP receberem valor alterado depois do aceite.

### 5. Ajustar Slack e ERP para ler somente o valor líquido aprovado

- Atualizar `approved-proposal-value.ts` para não cair em `dynamic_pricing_current_amount` bruto quando existir desconto comercial.
- Garantir que `post-acceptance-effects` usa `approved_amount/payment_expected_amount` líquido.
- Garantir que `notify-deal-won` envia ao ERP:
  - `amount`, `net_total`, `final_amount`, `total_amount`, `valor_liquido` = líquido final;
  - `gross_total` = bruto vigente;
  - `discount_total` e `discount_percent` corretos;
  - parcelas/datas vindas da condição de pagamento.

Arquivos impactados:
- `supabase/functions/_shared/approved-proposal-value.ts`
- `supabase/functions/post-acceptance-effects/index.ts`
- `supabase/functions/notify-deal-won/index.ts`

### 6. Corrigir cobrança/payment intent

- `create_proposal_payment_intent` deve cobrar o líquido final do resolver.
- Se for cronograma manual/parcelas, cada parcela deve usar o líquido final como base e respeitar datas manuais.
- Nada deve cobrar somente o bruto da tabela dinâmica.

### 7. Ajustar exibição da proposta/PDF

A UI deve separar claramente:

```text
Subtotal dos itens: R$ 1.994,00
Ajuste por antecedência/pós-evento: +R$ 997,00
Valor vigente bruto: R$ 2.991,00
Desconto comercial (15%): -R$ 448,65
Total aprovado: R$ 2.542,35
```

E as parcelas devem somar exatamente o total aprovado.

Arquivos prováveis:
- `src/components/proposals/ProposalPaymentTerms.tsx`
- componentes de preview/PDF de proposta
- banners de tabela dinâmica, se estiverem mostrando bruto como se fosse final

### 8. Correção pontual dos dados já afetados

Após a regra estar corrigida, rodar uma correção controlada para propostas recentes afetadas, incluindo Lactalis/OGGI/NETSEEDS:

- recalcular `payment_expected_amount`;
- corrigir `approved_amount` quando aceito;
- corrigir `opportunities.valor_previsto`;
- não reenviar automaticamente Slack/ERP sem confirmação explícita.

### 9. Testes de regressão obrigatórios

Criar testes cobrindo estes cenários:

- `R$ 2.991,00 - 15% = R$ 2.542,35`.
- Parcela após início do evento usa faixa pós-evento.
- À vista com desconto usa líquido.
- 50/50 com datas manuais soma exatamente o líquido.
- Cronograma manual com datas arbitrárias soma exatamente o líquido.
- Slack e ERP recebem o mesmo líquido.
- Duplicatas em `proposal_payment_terms` não fazem o desconto sumir.

## Riscos

- Existem dados históricos já gravados com campos conflitantes; vou tratar correção histórica separada da regra nova.
- Slack/ERP podem já ter recebido valores errados; não vou reenviar sem sua confirmação.
- O trigger legado de contrato precisa ser ajustado com cuidado para não duplicar contratos nem reabrir aceite antigo.

## Resultado esperado

Depois da correção, todo o sistema passa a falar uma língua só:

```text
Valor aprovado = valor vigente bruto da condição comercial - desconto da forma/prazo de pagamento.
```

Para Lactalis, o valor final exibido, salvo, notificado e enviado ao ERP será **R$ 2.542,35**.