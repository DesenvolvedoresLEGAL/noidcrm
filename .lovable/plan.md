## Por que email e telefone aparecem vazios no Kairós

O Apollo trabalha em **dois passos**:

1. **Search** (`mixed_people/api_search`) — descobre quem trabalha na empresa, retorna nome, cargo, LinkedIn, mas **mascara email e telefone**. É o que rodamos hoje no enriquecimento.
2. **Match/Enrich** (`people/match`) — "revela" email e telefone de um contato específico. **Cobra créditos por revelação** (1 crédito por email + 1 por telefone, normalmente).

Quando você abre a Juliana direto no Apollo e clica em "Enriquecer contato", o Apollo executa o passo 2 e mostra os dados. Hoje o Kairós só faz o passo 1, por isso vem "sem e-mail / sem telefone".

A solução é adicionar o passo 2 no Kairós, **sob demanda e por contato** (não em massa, para não estourar créditos).

## O que vai mudar

### 1. Nova edge function `reveal-apollo-contact`
Recebe `enriched_contact_id`, busca o registro, chama `POST https://api.apollo.io/api/v1/people/match` com:
- `id` (apollo_person_id já salvo) **ou** `first_name + last_name + organization_name + domain` como fallback
- `reveal_personal_emails: true`
- `reveal_phone_number: true`
- `webhook_url` opcional (telefone às vezes vem assíncrono — por enquanto, espera resposta síncrona; se vier vazio, registra "pending")

Atualiza `enriched_contact_profiles` com `email`, `email_status`, `phone`, e marca `revealed_at` + `reveal_credits_used`. Loga em `enrichment_jobs` (provider=`apollo_reveal`) para auditoria de créditos.

### 2. UI no painel de Contatos do prospect
Em cada card de contato, quando **não houver email/telefone**:
- Botão pequeno **"Revelar contato (1-2 créditos)"** ao lado dos campos vazios
- Loading inline; ao revelar, atualiza realtime via cache invalidation
- Confirmação leve antes de gastar créditos (modal pequeno: "Revelar contato da Juliana? Consome até 2 créditos Apollo.")

Se a Apollo retornar email/telefone vazio mesmo após reveal, mostrar badge "não disponível na Apollo" e não cobrar de novo (cache da tentativa por 24h, mesma regra do enrichment).

### 3. Importação no CRM
Continua igual — agora os contatos selecionados que foram revelados vão para `contacts` da conta com email/telefone populados (já funciona, só precisava dos dados).

## Arquivos

**Criar:**
- `supabase/functions/reveal-apollo-contact/index.ts`
- `src/components/playbook/enrichment/RevealContactButton.tsx`
- `src/hooks/useRevealApolloContact.ts`
- Migration: adicionar colunas `revealed_at timestamptz`, `reveal_credits_used int default 0`, `last_reveal_attempt_at timestamptz` em `enriched_contact_profiles`

**Editar:**
- `src/services/enrichment/apolloService.ts` — função `revealApolloContact(contactId)`
- `src/components/playbook/ProspectContactsTab.tsx` — botão de revelar em cada card sem email/telefone
- `src/integrations/supabase/types.ts` — auto-regenerado pela migration

## Detalhes técnicos

**Endpoint Apollo:** `POST https://api.apollo.io/api/v1/people/match` com header `x-api-key`. Body mínimo:
```json
{
  "id": "<apollo_person_id>",
  "reveal_personal_emails": true,
  "reveal_phone_number": true
}
```
Fallback quando não temos `apollo_person_id` salvo:
```json
{
  "first_name": "Juliana",
  "last_name": "Abreu",
  "organization_name": "Tirolez",
  "domain": "tirolez.com.br",
  "reveal_personal_emails": true,
  "reveal_phone_number": true
}
```

**Anti-spam:** `last_reveal_attempt_at` < 24h bloqueia nova revelação do mesmo contato (igual lógica do enrichment), evitando double-charge se o usuário clicar duas vezes.

**Telemetria:** insere em `enrichment_jobs` com `provider='apollo_reveal'`, `prospect_id`, `credits_used`, `response_summary={revealed_email, revealed_phone}` para o painel de auditoria já existente.

**Segurança:** edge function valida JWT, confirma que o contato pertence à `organization_id` do usuário antes de chamar a Apollo.

## Riscos

- Apollo às vezes retorna telefone via webhook assíncrono (delay de segundos). Se vier vazio na resposta síncrona, marcamos como "pendente" e o usuário pode tentar novamente em 1 min.
- Plano Apollo precisa ter `people/match` habilitado. Se vier 403, mostramos a mesma mensagem clara que já usamos no enrichment.
- Custo: cada clique consome 1-2 créditos. Por isso é por contato e com confirmação.

## Próximos passos depois (não nesta entrega)

- Botão "Revelar todos os decisores selecionados" em lote, com cálculo prévio de créditos.
- Toggle por organização: "auto-revelar contatos primários ao enriquecer".