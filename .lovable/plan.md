
Objetivo: corrigir de vez o PDF client-side em `src/lib/proposalPdfGenerator.ts` para que a quantidade não saia como `2.02`, o nome da solução fique destacado, a descrição respeite as quebras do cadastro e cada item não fique “partido” entre páginas.

1. Corrigir a quantidade no PDF
- Arquivo principal: `src/lib/proposalPdfGenerator.ts`
- Trocar o formatter atual por uma normalização mais defensiva, aceitando número/string e tratando vírgula/ponto corretamente.
- Garantir que a quantidade seja renderizada a partir de `item.quantity` puro, sem qualquer reaproveitamento de lógica de preço.
- Regra de exibição:
  - inteiro real → `2`
  - decimal válido → `2,02`
  - valor com artefato/float desnecessário → arredondar corretamente e remover ruído visual
- Durante a implementação, validar também `src/lib/proposalPdfBuilder.ts` só se houver indício de que o valor já chega errado antes do render.

2. Destacar o nome da solução
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Melhorar a primeira coluna da tabela para separar visualmente:
  - nome do item em negrito e fonte maior
  - descrição em fonte menor e peso normal
- Fazer isso com renderização customizada da célula do item no `autoTable`, em vez de jogar tudo como um texto único sem hierarquia.

3. Respeitar as quebras de linha da descrição
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Substituir o fluxo atual que “achata” a descrição por um helper que preserve:
  - `\n` do cadastro
  - `<br>`
  - separação de parágrafos/listas vindas de HTML
- Aplicar essa preservação especificamente na descrição dos itens, para o PDF refletir o cadastro do produto de forma fiel.

4. Melhorar a tabela para não quebrar item no meio da página
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Ajustar a configuração do `autoTable` para evitar quebra de uma mesma linha entre páginas.
- Se uma linha longa não couber no espaço restante, ela deve começar na página seguinte inteira.
- Manter o cabeçalho repetido automaticamente na nova página e deixar o resumo só depois do fim completo da tabela.

5. Ajustar layout das colunas para legibilidade
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Dar mais largura para a coluna `Item / Descrição`.
- Manter `Qtd`, `Preço`, `Desconto` e `Total` compactas e estáveis.
- Corrigir o cabeçalho de desconto para não quebrar feio e alinhar células numéricas sem comprimir o conteúdo descritivo.

Resultado esperado
- quantidade sai correta, sem `2.02` indevido
- nome da solução fica visualmente destacado
- descrição respeita as quebras cadastradas no sistema
- cada item permanece inteiro na mesma página
- a tabela fica mais limpa e profissional para envio ao cliente

Detalhe técnico
- O arquivo prioritário continua sendo `src/lib/proposalPdfGenerator.ts`
- `src/lib/proposalPdfBuilder.ts` só entra no ajuste se, durante a implementação, ficar comprovado que a quantidade já está chegando incorreta antes da geração do PDF
