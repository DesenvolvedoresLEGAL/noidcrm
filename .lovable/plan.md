## Ajustes nas miniaturas de produto + alinhamento da Apresentação + imagens no PDF

Vou tratar 4 problemas reportados, sem mexer em lógica de preço/negócio.

### 1. Editor da proposta (`ProposalItemsManager.tsx`)
- Remover a miniatura 40×40 da esquerda do campo nome.
- Adicionar uma **nova coluna "Foto"** logo após a coluna "Item", com thumb **64×64** arredondada, borda sutil e placeholder com ícone quando não houver imagem.
- Ajustar o `<TableHeader>` para incluir o novo `<TableHead>Foto</TableHead>` e o `colSpan` de eventuais linhas de rodapé/totais.

### 2. Link público (`ProposalPublicView.tsx`) — Itens Avulsos e Recorrentes
- Remover a thumb 56×56 que hoje fica à esquerda do nome.
- Adicionar uma **coluna dedicada "Foto"** depois da coluna "Item" nas duas tabelas (avulsos e recorrentes), com thumb **72×72** (60×60 no mobile), `object-cover`, borda e cantos arredondados.
- Placeholder discreto (ícone em fundo `muted`) quando `image_url` for nulo, para manter alinhamento da coluna.
- Atualizar `colSpan` das linhas de subtotal/desconto/total para refletir a coluna extra.

### 3. Bloco "Apresentação" desalinhado (`ProposalPublicView.tsx`)
- O HTML do TipTap herda `text-align:center` quando o usuário centralizou parágrafos no editor; combinado com `prose max-w-4xl mx-auto` isso deixa o título "Apresentação" colado à esquerda e o corpo centralizado.
- Mudar o container de `max-w-4xl mx-auto` para **largura total do card** (`max-w-none`) e deixar o alinhamento horizontal ser controlado pelo próprio HTML salvo. Aplicar o mesmo padrão nos blocos de Termos e Observações (linhas 1974 e 1989) para consistência.
- Manter `prose prose-sm` para tipografia.

### 4. Imagem não aparece no PDF (`generate-proposal-pdf/index.ts`)
Hoje a query em `proposal_items` lê `image_url`, mas itens antigos (criados antes do sync produto→item) têm `image_url = null`. Além disso, mesmo quando presente, o Puppeteer/Chromium do gerador pode pular imagens que ainda não carregaram quando snapshota a página.

Correções:
- **Fallback de origem da imagem:** expandir o `select` para incluir `product:products(image_url)` e usar `item.image_url ?? item.product?.image_url` ao montar `thumb`.
- **Coluna dedicada "Foto"** no `<table class="items-table">` (após "Item / Descrição"), thumb **72×72** com `border-radius:6px`. Ajustar larguras das colunas (Item passa de ~45% para ~38%, nova coluna Foto 12%).
- Garantir que o gerador aguarde o carregamento das imagens antes do snapshot (`waitUntil: 'networkidle0'` se já não estiver, ou aguardar `img.complete`). Vou verificar/ajustar no ponto onde o HTML é convertido em PDF.
- Manter `onerror="this.style.display='none'"` como salvaguarda.

### Arquivos a editar
- `src/components/proposals/ProposalItemsManager.tsx`
- `src/pages/ProposalPublicView.tsx`
- `supabase/functions/generate-proposal-pdf/index.ts`

### Fora de escopo
- Upload de imagem direto pelo editor de itens (continua vindo do cadastro de Produto).
- Mudança de largura geral do link público (já está em `max-w-7xl`).
- Qualquer cálculo financeiro / RLS / multi-tenant.

### Riscos
- Coluna nova pode apertar layout em telas estreitas → mitigado escondendo a coluna Foto em `<sm` via `hidden sm:table-cell` no link público.
- Itens muito antigos sem `image_url` nem produto vinculado mostrarão placeholder (intencional).
- Mudar `max-w-4xl mx-auto` para `max-w-none` na Apresentação pode aumentar a largura de leitura — aceitável dado o pedido explícito de alinhamento.
