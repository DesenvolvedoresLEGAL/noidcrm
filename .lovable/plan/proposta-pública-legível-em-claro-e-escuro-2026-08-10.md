# Proposta pública legível em claro e escuro

## Problema
Ao abrir o link público (`/p/:token` e `/public/proposal/:token`) no celular, o app herda o tema `system` (celular quase sempre em escuro) e as descrições dos itens ficam ilegíveis. As descrições vêm do editor rich text e carregam cores fixas inline (texto azul/escuro), que o sanitizador atual preserva — no fundo escuro esse texto some.

## Solução

1. **Tema explícito na proposta pública**
   - A página pública passa a iniciar sempre em **modo claro**, independente da preferência do celular (é o modo esperado por clientes recebendo proposta).
   - Um botão discreto de claro/escuro no cabeçalho da proposta permite o cliente alternar; a escolha fica salva só para a visualização pública, sem afetar o tema do CRM interno.

2. **Descrições sempre legíveis**
   - Criar uma sanitização específica para conteúdo público que remove cores fixas de texto e de fundo vindas do editor (mantendo negrito, itálico, listas, links, tabelas e demais formatações).
   - Com as cores removidas, o texto passa a usar as cores do tema, ficando legível tanto no claro quanto no escuro.

3. **Revisão de contraste dos blocos coloridos**
   - Conferir os blocos âmbar/verde/azul (totais, descontos, condições de pagamento) para garantir contraste adequado no modo escuro.

## Detalhes técnicos
- `src/lib/sanitizeHtml.ts`: nova função `sanitizeRichTextForDisplay` (mesma whitelist, com hook do DOMPurify removendo `color`/`background-color`/`background` dos atributos `style` e do atributo `color`). Não altera o comportamento do `sanitizeHtml` já usado em e-mails e telas internas.
- `src/pages/ProposalPublicView.tsx`: usar a nova função nos dois pontos onde `item.description` é renderizado (linhas ~1494 e ~1705) e nos demais blocos de HTML da proposta.
- Tema: envolver a página pública em um escopo próprio — `next-themes` com `storageKey` dedicado e default `light` — via um pequeno wrapper (ex.: `PublicThemeScope`) aplicado apenas nas rotas públicas em `src/App.tsx`, evitando mexer no `ThemeProvider` global (`defaultTheme="system"`).
- Toggle: reutilizar o padrão do `ThemeToggle` existente, versão compacta (sol/lua) no header da proposta pública.
- Nada de backend, RLS, edge functions ou regras comerciais é alterado.

## Validação
- Abrir a proposta pública com o sistema em modo escuro: deve carregar clara e legível.
- Alternar para escuro pelo botão: descrições, tabelas e totais legíveis.
- Conferir em viewport mobile e desktop.
