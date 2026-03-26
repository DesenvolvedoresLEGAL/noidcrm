
Problema confirmado: o PDF que o usuário está vendo não vem da edge function `supabase/functions/generate-proposal-pdf/index.ts`. O fluxo atual de download usa o gerador client-side `src/lib/proposalPdfGenerator.ts`, chamado por `downloadProposalPDF(...)` em `ProposalPublicView.tsx`, `ProposalEditor.tsx` e `OpportunityProposalsTab.tsx`. Por isso os ajustes anteriores no HTML da edge function não corrigiram este PDF.

Plano de correção

1. Corrigir o header do cliente no PDF client-side
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Remover truncamento do nome do cliente (`substring(0, 30)`)
- Quebrar o nome em múltiplas linhas com `splitTextToSize`
- Ajustar a altura do card do cliente dinamicamente para comportar nomes longos como “CIELO...”
- Aplicar o mesmo cuidado para endereço, evitando corte visual

2. Corrigir o terceiro bloco para mostrar a oportunidade
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Hoje o card “PROPOSTA” mostra número + datas, mas não prioriza corretamente o título da oportunidade
- Alterar para exibir o título da oportunidade como campo principal do card
- Prioridade: `proposal.opportunity?.title` → fallback seguro → só depois `proposal.title`
- Renomear visualmente o campo para “Oportunidade” para bater com o combinado

3. Corrigir descrição completa dos itens
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Remover truncamento artificial da descrição (`substring(0, 100)`)
- Manter quebra automática de linha no `autoTable`
- Garantir que nome + descrição usem largura suficiente na primeira coluna

4. Corrigir formatação da quantidade
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- O “2.02” indica formatação inadequada para quantidade
- Criar formatter numérico específico para quantidade, sem usar lógica de moeda
- Exibir `2,02` quando decimal e `2` quando inteiro, com até 2 casas
- Manter unidade de medida apenas como sufixo

5. Ajustar cabeçalho/colunas da tabela
- Arquivo: `src/lib/proposalPdfGenerator.ts`
- Trocar “Desc.” por “Desconto” ou uma abreviação que não quebre feio
- Rebalancear larguras das colunas para priorizar a descrição do item
- Garantir `overflow: linebreak` e alinhamentos corretos

6. Alinhar os dados de origem para evitar fallback errado
- Arquivo: `src/lib/proposalPdfBuilder.ts`
- Garantir que `title` e demais campos flat não sobrescrevam o título da oportunidade de forma indevida
- Validar também `contact_email` / `contact_phone` com acesso JSONB consistente (`.value`) onde necessário

Resultado esperado
- Nome “CIELO...” quebra corretamente em vez de cortar
- Terceiro card mostra o título da oportunidade
- Descrição dos itens aparece completa
- Quantidade deixa de sair como “2.02.....” e passa a renderizar corretamente
- Tabela fica legível e consistente com a versão web

Detalhe técnico importante
- O arquivo prioritário para corrigir agora é `src/lib/proposalPdfGenerator.ts`
- `supabase/functions/generate-proposal-pdf/index.ts` pode continuar existindo para outro fluxo, mas não é ele que está gerando o PDF baixado pelo usuário neste momento
