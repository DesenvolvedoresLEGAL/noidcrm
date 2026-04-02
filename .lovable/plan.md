

# Corrigir Compositor de E-mail de Proposta

## Problemas Identificados

1. **E-mail primário não é puxado**: O `loadPrimaryContact` usa `e.principal || e.primary` mas o campo correto é `e.is_primary` (padrão do sistema em `ContactEmail`)
2. **Assunto duplicado**: Gera `Proposta Comercial: Proposta Comercial - BASELINKER...` porque o título da proposta já começa com "Proposta Comercial". Assunto deve ser `Proposta + título da oportunidade`
3. **Corpo aparece como código HTML**: Usa `<textarea>` que mostra HTML cru. Deve usar o `RichTextEditor` existente (`src/components/ui/rich-text-editor.tsx`)
4. **Link incorreto**: Usa `buildProposalPublicUrl` (Edge Function OG meta) no corpo do email. Para o link clicável no email, deveria usar `buildProposalDirectUrl` (URL direta do SPA `/p/{token}`)

## Alterações

### `src/components/proposals/ProposalEmailComposer.tsx`

| Correção | Detalhe |
|----------|---------|
| Email primário | Trocar `e.principal \|\| e.primary` por `e.is_primary` e usar `e.value` (campo correto do `ContactEmail`) |
| Assunto | Buscar `opportunity.title` na query e usar `Proposta ${opportunity.title}` |
| Rich Text Editor | Substituir `<textarea>` pelo `RichTextEditor` de `@/components/ui/rich-text-editor` |
| Link da proposta | Usar `buildProposalDirectUrl` para o link no corpo do email (URL SPA direta) |
| Query da proposta | Adicionar join com `opportunities(title)` para pegar o título da oportunidade |

