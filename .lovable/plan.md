# Sprint 3 — Ação "Perdeu" no Pré-vendas (Desqualificação)

Trocar o modal de perda padrão por um modal de **Desqualificação** dedicado quando a oportunidade está em pipeline `qualification`, mover para a etapa **Desqualificado**, opcionalmente duplicar para o funil **REMARKETING** e evitar duplicidade ativa.

## 1. Banco de dados (1 migração)

Adicionar colunas à `opportunities` (todas nullable, sem default agressivo):

- `qualification_loss_reason TEXT` — slug do motivo (19 opções fixas).
- `remarketing_source TEXT` — ex.: `pre_sales_disqualification`.
- `remarketing_reason TEXT` — cópia do motivo + observação para uso da fila de remarketing.
- `remarketing_status TEXT` — default `null`; setado `'pending'` na duplicata.
- `remarketing_created_at TIMESTAMPTZ`.
- Índice parcial:  
  `CREATE INDEX IF NOT EXISTS idx_opportunities_remarketing_dedup ON opportunities (source_opportunity_id) WHERE remarketing_source IS NOT NULL AND deleted_at IS NULL;`

Reusamos a coluna existente **`source_opportunity_id`** como `original_opportunity_id` (mesma semântica de handoff). Nada em RLS muda; políticas atuais já cobrem.

## 2. Constantes de domínio (frontend)

**Novo:** `src/lib/qualification/disqualifyReasons.ts`

Enum estático com as **19 opções** (slug + label) conforme briefing:

```
sem_evento, sem_data, sem_local, sem_escopo_minimo,
sem_conexoes, sem_finalidade, sem_urgencia, sem_decisor,
sem_proximo_passo, cliente_pesquisando, pedido_generico_preco,
baixa_maturidade, nao_respondeu, nao_visualizou_proposta,
nao_precisa_solucao, fora_icp, concorrente_escolhido,
preco_inviavel, outro
```

## 3. Service de desqualificação

**Novo:** `src/services/crm/disqualify.ts`

```ts
disqualifyPreSalesOpportunity(opportunityId, {
  reasonSlug, observation, createRemarketing
}): Promise<{ disqualified: true; duplicated: boolean; remarketingExisted: boolean; remarketingOpportunityId?: string }>
```

Passos:

1. Carrega `opportunities` + `accounts(id,nome_fantasia,razao_social)` + `contacts(id,nome,emails)` + `pipeline:pipelines(pipeline_type,organization_id)`. Valida que `pipeline_type='qualification'`.
2. Resolve `desqualificadoStageId` em `stages` do mesmo pipeline com `name ILIKE 'desqualificad%'` (`order_index DESC` para pegar a final). Fallback: mantém `stage_id` atual e loga warn (não bloqueia).
3. **Update** na oportunidade original:
   - `status='lost'`, `stage_id=desqualificadoStageId`
   - `qualification_loss_reason=reasonSlug`
   - `loss_comment=observation || null`
   - `closed_at=now`, `updated_at=now`
   - `closed_by` é setado por trigger existente (`closed_at` é fonte da verdade — Core rule respeitada).
   - Limpa score/AI fields como `markOpportunityAsLost` faz.
4. **win_loss_records**: upsert com `outcome='lost'`, `reason_id=null`, `reason_seller=observation`, `loss_accountability='unknown'`. Apenas para manter tracking consistente.
5. **Anti-duplicidade**: query `from('opportunities').select('id').eq('source_opportunity_id', opportunityId).eq('remarketing_source','pre_sales_disqualification').is('deleted_at', null).in('status', ['new','open']).limit(1)`. Se existir → retorna `remarketingExisted=true, duplicated=false`.
6. Se `createRemarketing && !remarketingExisted`:
   - Resolve **REMARKETING pipeline**: `pipelines` da org com `pipeline_type='renewal'` e `name ILIKE '%remarketing%'` (limit 1). Se ausente → `duplicated=false` + toast "Funil Remarketing não configurado".
   - Stage inicial: menor `order_index`.
   - Insert nova opportunity copiando: `title` (mantém UPPERCASE — trigger já força), `account_id`, `contact_id`, `owner_user_id`, `origem`, `valor_previsto` (se houver), `produto` se houver. Define `pipeline_id`, `stage_id`, `status='new'`, `source_opportunity_id=opportunityId`, `remarketing_source='pre_sales_disqualification'`, `remarketing_reason=reasonSlug + (observation ? ' — ' + observation : '')`, `remarketing_status='pending'`, `remarketing_created_at=now`.
   - **Custom form values**: lê linha de `custom_form_values` do checklist obrigatório (entity_id=original) e insere clone para a nova entity_id (mesma `custom_form_id`, mesmos `values` — herda nome/data/local do evento, conexões, equipamentos, finalidade). `filled_by` = usuário atual; `filled_at=now`.
7. Chama `processPendingWorkflows(opportunityId)` (mesmo padrão de `lossMutation`).
8. Retorna `{ disqualified: true, duplicated: !!createRemarketing && !remarketingExisted, remarketingExisted, remarketingOpportunityId }`.

## 4. UI — `DisqualifyLeadModal`

**Novo:** `src/components/opportunity/DisqualifyLeadModal.tsx`

Campos:
- **Motivo da desqualificação** (`Select`, obrigatório) — 19 opções.
- **Observação** (`Textarea`, opcional, max 2000 char).
- **Toggle** "Sim, criar oportunidade no funil Remarketing" (default ON).
- Botões: Cancelar / **Confirmar desqualificação** (destructive).

Pré-detecção de duplicata:
- Ao abrir, dispara `useQuery` que consulta a mesma condição do passo 5 acima. Se já existir → toggle fica **desabilitado e marcado como off**, com banner informativo: *"Lead desqualificado e já existente no Remarketing."* (com link "Abrir oportunidade no Remarketing").

Submit:
- Chama mutation que invoca `disqualifyPreSalesOpportunity`.
- Em sucesso: invalida cache, fecha modal. Toast:
  - `duplicated=true` → "Lead desqualificado. Nova oportunidade criada no Remarketing."
  - `remarketingExisted=true` → "Lead desqualificado e já existente no Remarketing."
  - sem remarketing pipeline → "Lead desqualificado. Funil Remarketing não configurado."
  - toggle off → "Lead desqualificado."

## 5. Roteamento no `OpportunityDetail.tsx`

- `handleLost()` decide: se `opportunity.pipeline?.pipeline_type === 'qualification'`, abre `DisqualifyLeadModal`; senão, abre `LossReasonModal` (comportamento atual).
- Nova `disqualifyMutation` separada da `lossMutation` para isolar erros e mensagens.
- `LossReasonModal` continua intacto (regras de Vendas).

## 6. Arquivos

**Novos**
- `supabase/migrations/<ts>_qualification_disqualify_and_remarketing.sql`
- `src/lib/qualification/disqualifyReasons.ts`
- `src/services/crm/disqualify.ts`
- `src/components/opportunity/DisqualifyLeadModal.tsx`

**Editados**
- `src/pages/OpportunityDetail.tsx` — roteamento + mutation.

Nada em forecast, revenue, dashboards ou OTE muda.

## 7. Riscos & decisões

- **Reuso de `source_opportunity_id`**: alinha com `mem://crm/deal-handoff-data-continuity` e com a unique index existente. Tratamos `original_opportunity_id` do briefing como alias semântico.
- **`closed_at` imutável (Core rule)**: respeitado — só preenchido na transição `open → lost`. Reabertura existente já trata `closed_at` corretamente.
- **Stage "Desqualificado"** pode não existir em todas as orgs com `qualification` — fallback documentado (mantém stage atual + warn).
- **Funil REMARKETING** detectado por `pipeline_type='renewal' AND name ILIKE '%remarketing%'`; se ausente, apenas pula a duplicação sem falhar a desqualificação.
- **Win-loss reporting**: gravamos `win_loss_records` mas com `reason_id=null`. Charts agregam por motivo via `qualification_loss_reason` numa sprint futura (fora deste escopo). Hoje aparecerá como "Sem motivo classificado" em Win/Loss Hub para esses casos — risco menor, pipeline qualification já tem visão própria.
- **Trigger UPPERCASE** mantém título consistente na duplicata automaticamente.

## 8. Validação manual

1. Em PRÉ VENDAS, clicar **Perdeu** → modal "Desqualificar lead" abre (e não o de Vendas).
2. Selecionar motivo + observação, toggle ON, confirmar → original vira `lost` no stage Desqualificado e nova oportunidade aparece em REMARKETING com mesma empresa/contato/owner e checklist herdado.
3. Tentar desqualificar de novo o mesmo lead → toggle desabilitado + banner "já existente no Remarketing".
4. Em VENDAS, clicar **Perdeu** → modal atual `LossReasonModal` continua aparecendo.
