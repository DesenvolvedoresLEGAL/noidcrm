

## Problema

O PDF gerado pela edge function `generate-proposal-pdf` tem vários problemas visuais e de dados comparado com a versão web:

1. **Nome da empresa cortado** no header - `h1` com `font-size: 28px` sem controle de overflow
2. **Sem cards separados de Cliente/Contato/Proposta** - o PDF usa um `info-grid` único, sem exibir dados do contato (telefone, email, cargo)
3. **Descrição dos itens truncada** - não há truncamento explícito no código, mas o campo `item.description` pode estar vindo cortado do banco
4. **Coluna "Desconto" ausente/quebrada** - a tabela de itens não tem coluna de desconto
5. **Totais repetitivos** na página 2 - subtotal + total quando há apenas itens avulsos fica redundante
6. **Contrato/anexos não aparecem** - os layout pages só mostram link, não embute o conteúdo

## Arquivo alterado

`supabase/functions/generate-proposal-pdf/index.ts` (função `generateProposalHTML`)

## Mudanças

### 1. Header - nome da empresa
- Reduzir `font-size` do `h1` de `28px` para `22px`
- Adicionar `word-break: break-word` e `max-width` para evitar corte
- Incluir endereço completo, telefone e email no bloco esquerdo (como na web)

### 2. Cards de Cliente, Contato e Proposta
- Substituir o `info-grid` único por **3 cards lado a lado** (grid 3 colunas) igual à versão web:
  - **Cliente**: razão social, nome fantasia, CNPJ, endereço, telefone, email (dados de `account`)
  - **Contato**: nome, cargo, telefone (`contact.telefones[0].value`), email (`contact.emails[0].value`)
  - **Proposta**: título da oportunidade, data criação, validade, método pagamento
- Usar acesso correto ao JSONB: `contact.emails[0].value` e `contact.telefones[0].value`

### 3. Tabela de itens - descrição completa e coluna desconto
- Mostrar `item.description` completo (sem truncar)
- Adicionar coluna **"Desconto"** entre "Preço Unit." e "Total"
- Exibir `item.discount_percent` ou `-` quando zero
- Ajustar larguras: Item (45%), Qtd (8%), Preço Un. (15%), Desconto (12%), Total (20%)

### 4. Totais - remover repetição
- Quando há apenas itens avulsos (sem recorrentes), mostrar só o total final sem subtotal separado
- Quando há ambos (avulso + recorrente), mostrar subtotal avulso, subtotal recorrente e total geral
- Remover o bloco `value-highlight` que duplicava o total

### 5. Anexos do contrato
- Para layout pages com `file_url` de imagem (PNG/JPG), embutir diretamente com `<img>` no PDF
- Para PDFs, manter o link com botão de download
- Cada página em `page-break-before: always` para não cortar

### Resumo

| Problema | Correção |
|----------|----------|
| Nome empresa cortado | Reduzir fonte, word-break |
| Dados contato ausentes | 3 cards separados com dados de account + contact |
| Descrição itens truncada | Exibir description completo |
| Coluna desconto quebrada | Nova coluna com largura adequada |
| Totais repetitivos | Lógica condicional por tipo de item |
| Contrato não aparece | Embutir imagens dos layout pages |

Apenas 1 arquivo: `supabase/functions/generate-proposal-pdf/index.ts`

