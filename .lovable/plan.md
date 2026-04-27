# Sprint C.1 — Hardening do Learning Loop

3 ajustes cirúrgicos antes da próxima sprint. Tudo construído sobre o que já existe (`revenue_events`, `learning_signals`, `track-event`, `update-learning-signals`). Nada novo é criado em duplicidade.

---

## 1. Classificação de eventos: `action` vs `outcome`

**Problema:** hoje `email_sent` e `deal_won` são tratados quase iguais pelo learning. Ações não devem ensinar tanto quanto resultados.

**Mudança no banco** (`revenue_events` — não criar `lifecycle_events` nova, já existe a canônica):

```sql
ALTER TABLE public.revenue_events
ADD COLUMN IF NOT EXISTS event_class TEXT
CHECK (event_class IN ('action','outcome','system'));

CREATE INDEX IF NOT EXISTS idx_revenue_events_class
  ON public.revenue_events (organization_id, event_class, created_at DESC);
```

**Mapa em `track-event`:**

| Classe | Eventos |
|---|---|
| `action` | `email_sent`, `email_delivered`, `email_opened`, `email_clicked`, `whatsapp_sent`, `call_made`, `call_connected`, `task_created` |
| `outcome` | `email_replied`, `whatsapp_replied`, `meeting_booked`, `opportunity_qualified`, `opportunity_disqualified`, `deal_won`, `deal_lost`, `email_bounced`, `unsubscribed` |
| `system` | `enrichment_completed`, `decision_executed`, `opportunity_created` |

**Regra de aprendizado:** apenas `event_class = 'outcome'` dispara `update-learning-signals`. `action` e `system` ficam só para timeline e métricas operacionais.

---

## 2. Atribuição de causa (metadata estruturado)

**Problema:** sistema sabe que algo deu certo, mas não sabe **o quê** causou.

**Padronização do `payload` em `revenue_events`** — campos canônicos sempre presentes quando aplicáveis:

```json
{
  "playbook_id": "...",
  "decision_rule_id": "...",
  "sequence_id": "...",
  "template_id": "...",
  "template_variant": "v1",
  "channel": "email",
  "owner_id": "...",
  "touch_number": 1,
  "source": "..."
}
```

**Implementação:**
- `track-event` valida e normaliza esses campos no payload (não rejeita se ausentes — apenas garante shape).
- `update-learning-signals` passa a registrar **dimensões de atribuição** ao agregar o sinal: além de `signal_type/signal_value`, salva `last_playbook_id`, `last_template_variant`, `last_decision_rule_id` numa coluna `attribution_breakdown jsonb` em `learning_signals` (contadores agrupados por dimensão).
- Edge functions emissoras já existentes (`run-decision-engine`, `run-enrichment`, agentes de e-mail) passam a injetar esses campos quando chamam `track-event`. Sem mexer em UI.

**Mudança no banco:**

```sql
ALTER TABLE public.learning_signals
ADD COLUMN IF NOT EXISTS attribution_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
```

`attribution_breakdown` armazena:
```json
{
  "by_playbook":   {"<playbook_id>": {"pos":3,"neg":1}},
  "by_template":   {"v1": {"pos":5,"neg":0}, "v2": {"pos":1,"neg":3}},
  "by_channel":    {"email": {"pos":4,"neg":2}}
}
```

Isso responde **"qual playbook/template/canal funcionou"** sem criar tabela nova.

---

## 3. Delay de aprendizado (anti-overfitting)

**Problema:** sinais de "resposta" podem ser ruidosos (auto-reply, fora do escritório). Já `deal_won` é definitivo.

**Regra de delay por tipo de evento:**

| Evento | Delay antes de impactar learning |
|---|---|
| `email_replied`, `whatsapp_replied` | **24h** |
| `meeting_booked` | **6h** |
| `opportunity_qualified` | **6h** |
| `deal_won`, `deal_lost`, `unsubscribed`, `email_bounced` | **imediato** |

**Implementação (não bloqueia a thread):**
1. `track-event` continua gravando o evento imediatamente em `revenue_events`.
2. Para outcomes com delay, em vez de chamar `update-learning-signals` síncrono, enfileira numa nova tabela leve:

```sql
CREATE TABLE public.learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.revenue_events(id) ON DELETE CASCADE,
  process_after TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','cancelled','failed')),
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_learning_queue_due
  ON public.learning_queue (status, process_after)
  WHERE status = 'pending';
```

3. **Cancelamento de ruído:** se o lead receber um evento contraditório dentro da janela (ex: `email_replied` seguido de `unsubscribed` em 2h, ou `meeting_booked` cancelada), a entrada na fila é marcada `cancelled` antes de impactar o score.

4. Nova edge `process-learning-queue` (cron a cada 15min via `pg_cron` ou trigger manual) processa entradas com `process_after <= now()` e dispara `update-learning-signals` com o evento original.

5. `deal_won` / `deal_lost` continuam invocando `update-learning-signals` direto (sem fila).

---

## Resumo de mudanças

**Migrações (1 SQL):**
- `revenue_events.event_class` + index
- `learning_signals.attribution_breakdown`
- `learning_queue` (nova) + index + RLS (service_role only)

**Edge Functions:**
- `track-event/index.ts` — adiciona `event_class`, normaliza atribuição, roteia outcomes para fila ou processamento imediato.
- `update-learning-signals/index.ts` — atualiza `attribution_breakdown`, lê dimensões do payload do evento.
- `process-learning-queue/index.ts` (nova) — drena fila, cancela contradições, chama `update-learning-signals`.
- `run-decision-engine`, `run-enrichment`, agentes de e-mail — passam atribuição completa ao chamar `track-event` (ajustes pontuais).

**Frontend:**
- `DecisionAuditPanel` ganha filtro `event_class`.
- `SignalsPanel` ganha breakdown de atribuição (qual playbook/template puxou o sinal) — usa `attribution_breakdown` já agregado, sem query nova.
- `ProspectLifecycleTimeline` mostra badge `Ação` vs `Resultado`.

**Sem duplicação:** reusa `revenue_events`, `learning_signals`, `track-event`, `update-learning-signals`. Apenas 1 tabela nova (`learning_queue`) que serve um propósito específico (delay anti-overfitting) que nenhum sistema atual cobre.

---

## Riscos & mitigação

- **Backfill de `event_class`:** eventos antigos ficam `NULL`. Migração inclui UPDATE inicial classificando histórico pelo `event_type`.
- **Cron de fila:** se `pg_cron` não estiver habilitado, `process-learning-queue` pode ser chamada por workflow agendado existente ou trigger no próximo `track-event` (best-effort drain).
- **Atribuição opcional:** payloads antigos sem `playbook_id` continuam funcionando — `attribution_breakdown` só agrega o que existe.

---

## Critério de sucesso

- Eventos classificados (`action`/`outcome`/`system`) e filtráveis na auditoria.
- `learning_signals.attribution_breakdown` populado e visível na UI.
- `email_replied` levando ≥24h para mover `impact_score`; `deal_won` imediato.
- Contradição dentro da janela (reply→unsubscribe) cancela aprendizado positivo.
