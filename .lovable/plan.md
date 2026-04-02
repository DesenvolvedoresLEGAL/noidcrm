
# Correções: Envio de Proposta por Email + Auto-preenchimento do "Para" + Tom da IA

## Problema 1: Envio de proposta por email não funciona

**Causa:** No `ProposalViewModal.tsx`, a seção "Enviar por Email" só aparece quando `proposal.pdf_url` existe (linha 127). Se a proposta não tem PDF gerado, o botão de envio não aparece. Além disso, o `sendProposalEmail` tenta SMTP primeiro, mas o fallback usa a Edge Function `send-proposal-email` que depende de Resend com `from: onboarding@resend.dev` — endereço com entrega limitada.

**Correção:**
- **`ProposalViewModal.tsx`**: Remover a condição `pdf_url` da seção de envio por email. Toda proposta com `public_token` pode ser enviada (o link público é o principal). Manter PDF como opcional.
- **`sendProposalEmail` em `proposals.ts`**: Priorizar sempre o SMTP do usuário. Se o SMTP falhar, usar a Edge Function `send-smtp-email` como fallback único (remover dependência do Resend/`send-proposal-email`). Garantir que o `public_token` seja usado para gerar o link, mesmo sem PDF.

## Problema 2: Campo "Para" não pré-preenchido no EmailComposer

**Causa:** O `OpportunityEmailsTab` chama `<EmailComposer>` sem passar `defaultTo` nem `contactName`. A tab só recebe `opportunityId` e não busca os dados do contato.

**Correção em `OpportunityEmailsTab.tsx`:**
- Buscar o contato da oportunidade (com email primário via `is_primary`) ao montar o componente
- Passar `defaultTo={[primaryEmail]}` e `contactName={contactName}` ao `EmailComposer`

```typescript
// Buscar contato da oportunidade
const { data: opp } = await supabase
  .from('opportunities')
  .select('contact:contacts(nome, emails)')
  .eq('id', opportunityId)
  .single();

const primaryEmail = opp?.contact?.emails?.find(e => e.is_primary)?.email 
  || opp?.contact?.emails?.[0]?.email || '';
```

## Problema 3: Tom da IA muito formal ("Prezado")

**Causa:** O prompt no `ai-email-assist` (linha 324) instrui: "Escreva emails persuasivos, **profissionais**" e as regras de cenário usam termos como "Profissional", "Assertivo". Não há instrução para tom descontraído/informal.

**Correção em `supabase/functions/ai-email-assist/index.ts`:**
- Alterar o system prompt (linha 324) para tom mais casual e direto
- Adicionar regra geral no prompt (linhas 149-155) orientando cumprimento informal: "Olá [Nome]" ou "[Nome], tudo bem?" em vez de "Prezado(a)"
- Atualizar cada cenário para usar "TOM: Casual e direto" em vez de "Profissional"

Exemplo de alteração no system prompt:
```
"Você é um especialista em copywriting de vendas B2B. 
Escreva emails curtos, diretos e com tom INFORMAL/DESCONTRAÍDO. 
Use cumprimentos como 'Oi [Nome]', '[Nome], tudo bem?', 'E aí [Nome]!'. 
NUNCA use 'Prezado(a)', 'Caro(a)', ou linguagem excessivamente formal."
```

E na regra geral:
```
- Use tom INFORMAL e amigável. Cumprimente com "Oi", "E aí", ou direto pelo nome
- NUNCA use "Prezado(a)", "Caro(a)", "Vossa Senhoria" ou saudações formais
- Escreva como se fosse uma conversa entre colegas de negócio
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/proposals/ProposalViewModal.tsx` | Exibir envio por email mesmo sem PDF (usar public_token) |
| `src/services/supabase/proposals.ts` | Corrigir `sendProposalEmail` para funcionar sempre via SMTP |
| `src/components/opportunity/OpportunityEmailsTab.tsx` | Buscar contato e passar `defaultTo`/`contactName` ao EmailComposer |
| `supabase/functions/ai-email-assist/index.ts` | Alterar tom para informal/descontraído |

## Deploy
Redeploy de `ai-email-assist` após alteração do tom.
