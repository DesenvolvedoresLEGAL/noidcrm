# Fix: Re-aceitação de proposta não notifica/celebra/Slack e workflow ignora duplicata soft-deleted

## Contexto

A proposta `ab76157a` (PONTOBR) foi reaceita hoje 28/04 16:40 por Milena. Status já era `accepted` desde 16/04, então o trigger `enqueue_acceptance_effect_job` não criou job novo (guard só dispara em transição `* -> accepted`). Em paralelo, o workflow de aceitação tentou duplicar a opp para o funil OPERACIONAL mas pulou porque encontrou a duplicata antiga `467bbae1` — sem notar que ela está soft-deleted desde 28/04 09:37.

Resultado: nenhuma notificação in-app, nenhuma celebração, nenhum aviso Slack, nenhuma opp operacional ativa.

## Mudanças

### 1. Trigger `enqueue_acceptance_effect_job` — permitir re-aceitação real

Mudar a condição para também disparar quando `accepted_at` muda mesmo com `status` já em `accepted`. Isso captura o caso real onde o cliente reabre o link e reconfirma após uma soft-delete da duplicata operacional ou após uma reativação manual.

A unique constraint em `acceptance_effect_jobs(proposal_id)` precisa relaxar para permitir um novo job por re-aceitação. Opções:
- Trocar para constraint composta `(proposal_id, accepted_at)` e incluir `accepted_at` como coluna do job
- Ou remover unique e adicionar índice para idempotência via `accepted_at` no próprio INSERT

Vou usar a opção composta, mais auditável.

```sql
-- Adicionar coluna accepted_at em acceptance_effect_jobs
ALTER TABLE public.acceptance_effect_jobs
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Backfill com proposals.accepted_at via subquery
UPDATE public.acceptance_effect_jobs j
   SET accepted_at = p.accepted_at
  FROM public.proposals p
 WHERE p.id = j.proposal_id AND j.accepted_at IS NULL;

-- Trocar unique
ALTER TABLE public.acceptance_effect_jobs
  DROP CONSTRAINT IF EXISTS acceptance_effect_jobs_proposal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS acceptance_effect_jobs_proposal_acceptance_uq
  ON public.acceptance_effect_jobs (proposal_id, accepted_at);

-- Atualizar trigger
CREATE OR REPLACE FUNCTION public.enqueue_acceptance_effect_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND NEW.accepted_at IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'accepted'
       OR OLD.accepted_at IS DISTINCT FROM NEW.accepted_at
     )
  THEN
    INSERT INTO public.acceptance_effect_jobs (proposal_id, organization_id, opportunity_id, accepted_at)
    VALUES (NEW.id, NEW.organization_id, NEW.opportunity_id, NEW.accepted_at)
    ON CONFLICT (proposal_id, accepted_at) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
```

### 2. Workflow automation — anti-duplicação respeita soft-delete

Encontrar a função/edge que executa a action `duplicate` do workflow (executor de `automation rules`). Onde hoje verifica "existe opp filha em pipeline X com `source_opportunity_id = origem`", incluir filtro `AND deleted_at IS NULL`. Sem isso uma duplicata jogada na lixeira bloqueia a recriação.

Localização provável: `supabase/functions/process-pending-workflows/` ou `supabase/functions/_shared/workflow-actions/duplicate.ts`. Vou inspecionar e ajustar.

### 3. Higiene: edge de aceite pública precisa atualizar `updated_at`

No edge function de public proposal acceptance, garantir que o UPDATE inclua `updated_at = now()`. Hoje só toca `accepted_at`/`status`/dados do aceitante, deixando `updated_at` congelado e atrapalhando ordenação e cache invalidation.

### 4. Reprocessar o caso PONTOBR (one-shot)

Após aplicar 1 e 2:
- Inserir manualmente um job em `acceptance_effect_jobs` para `proposal_id = ab76157a` com `accepted_at = 2026-04-28 19:40:30+00` para que o worker padrão processe notificações, celebração e Slack.
- Restaurar opp `467bbae1` (set `deleted_at = NULL`) OU rodar o workflow manualmente para gerar nova duplicata operacional. Pergunta para o usuário antes de decidir (ver abaixo).

### 5. Observabilidade

Adicionar log em `system_events` quando `enqueue_acceptance_effect_job` dispara via re-aceitação (vs primeira aceitação) para distinguir os dois caminhos no audit.

## Arquivos impactados

- `supabase/migrations/<novo>.sql` — itens 1 (schema + trigger).
- `supabase/functions/_shared/workflow-actions/*` ou `process-pending-workflows/index.ts` — item 2.
- `supabase/functions/<accept-proposal-public>/index.ts` (nome real a confirmar) — item 3.
- Migration extra one-shot ou script de exec — item 4.

## Riscos

- **Reprocessar a PONTOBR**: pode disparar celebração para um deal que o time já considera fechado mentalmente. Aceitável, é o comportamento correto.
- **Re-aceitações repetidas**: agora cada novo `accepted_at` gera novo job. Se um cliente abre o link 5x e reconfirma, vamos celebrar 5x. Mitigação: o edge function público só atualiza `accepted_at` quando o usuário clica em "Aceitar" explicitamente (não em cada view), o que é o caso atual. Posso adicionar dedupe extra no worker de notificação ("não notificar mesma proposta accepted 2x em janela de 5 min") se você quiser camada extra.
- **Workflow duplicate ignorando soft-delete**: o comportamento novo passa a recriar a opp operacional mesmo quando havia uma na lixeira. Isso é o comportamento desejado, mas vale checar se algum tenant usa soft-delete intencional para evitar recriação.

## Validação

1. Após migration, confirmar via SELECT que trigger novo está ativo e índice composto existe.
2. Reprocessar PONTOBR e validar: notificação in-app aparece, modal de celebração dispara para Wagner, mensagem no Slack do tenant, opp operacional recriada (ou opp `467bbae1` reativada conforme decisão).
3. Teste manual: duplicar uma proposta accepted, voltar para draft, reenviar, reaceitar — deve gerar novo job.
4. Build verde.

## Pergunta antes de implementar

Para o item 4, qual comportamento você prefere para a opp operacional `467bbae1` que está na lixeira?
- (a) Restaurar a existente (`deleted_at = NULL`) — preserva histórico interno se houver
- (b) Criar uma nova duplicata via workflow — começa do zero, opp antiga fica perdida na lixeira
