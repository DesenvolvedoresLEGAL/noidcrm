

## Diagnóstico

Investiguei `/app/activities` e identifiquei os 3 bugs:

### Bug 1 — Falta exclusão em lote
Não existe seleção múltipla. `ActivityTable` só tem ações por linha (Check, X, Pencil, Trash2). Sem checkbox por linha, sem checkbox header, sem barra de ações em massa.

### Bug 2 — Lista de usuários inclui inativos/excluídos
`Activities.tsx` linha 110-113 carrega `organization_members` SEM filtro de `status='active'` e SEM filtro de `deleted_at IS NULL`. A tabela `organization_members` tem ambos os campos. Resultado: o dropdown "Vendedor" mostra todos que algum dia entraram na org.

### Bug 3 — Badges divergem da listagem (1161 ≠ 5, 1168 ≠ 5)
Causa raiz em `getActivityStats()` (linhas 263-300 de `services/supabase/activities.ts`):
- **Atrasadas (overdue):** badge usa `lt('scheduled_date', startOfToday)` SEM limite inferior — pega atividades de 2024 ainda pendentes (1161 itens). Quando o usuário clica, `listActivities` aplica o MESMO filtro e deveria mostrar 1161 — mas a paginação mostra "Mostrando 1-20 de 1161" (correto). O 1161 vs "5 mostrados" do print é **desalinhamento entre badge "Hoje=5" e lista filtrada por outra coisa**.
- **Planejadas (scheduled):** badge calcula `eq('status','pending')` SEM filtro de data → conta TODAS pendentes (1168). Quando clica em "Planejadas", o filtro `case 'scheduled'` aplica `gte('scheduled_date', startOfToday)` → só futuras (5). **Mesmo nome, lógicas diferentes.**
- **Esse Mês (410):** badge usa `gte('scheduled_date', startOfMonth)` (mês inteiro, passado+futuro). Filtro da lista usa `gte(startOfToday).lte(endOfMonth)` (só restante do mês). Divergente.

**A regra precisa ser idêntica entre badge e lista.**

## Plano

### FASE 1 — Reconciliar badges com lista (CRÍTICO)
Reescrever `getActivityStats()` para usar **exatamente** as mesmas janelas de data que `listActivities` usa em cada `date_filter`:
- `overdue`: `scheduled_date < hoje` E `status='pending'` (mantém — já consistente)
- `today`: `hoje ≤ scheduled_date < amanhã` E pending
- `this_week`: `hoje ≤ scheduled_date < hoje+7d` E pending (hoje em diante, não retroativo)
- `this_month`: `hoje ≤ scheduled_date ≤ fim_do_mês` E pending
- `scheduled`: `scheduled_date ≥ hoje` E pending (futuras — alinhado com filtro)

Adicionar `.is('deleted_at', null)` em todas as 5 queries (hoje falta).

Resultado: clicar em "Planejadas 1168" vai mostrar 1168 itens reais (não 5).

### FASE 2 — Filtrar usuários inativos do dropdown
Em `Activities.tsx` linhas 110-113, adicionar:
```ts
.eq('status', 'active')
.is('deleted_at', null)
```
Dropdown passa a mostrar só membros realmente ativos.

### FASE 3 — Exclusão em lote
1. **`ActivityTable.tsx`**: adicionar coluna inicial com `<Checkbox>` por linha + checkbox no header (selecionar/desmarcar todos da página). Estado `selectedIds: Set<string>` controlado pelo pai.
2. **`ActivityCard.tsx`** (mobile): adicionar checkbox no canto superior esquerdo do card.
3. **Nova `BulkActionsBar`** em `src/components/activities/BulkActionsBar.tsx`: barra fixa que aparece quando `selectedIds.size > 0`, mostra "X selecionada(s)" + botão "Excluir selecionadas" (destructive) + botão "Cancelar seleção".
4. **`Activities.tsx`**: 
   - Estado `selectedIds: Set<string>`
   - Handler `handleBulkDelete()`: abre `AlertDialog` de confirmação → loop com `Promise.allSettled(ids.map(id => deleteActivity(id)))` → toast com "X excluídas, Y falharam" → `loadActivities()` + limpar seleção.
   - Limpar seleção ao trocar página, filtro ou status.
5. **`services/supabase/activities.ts`**: adicionar `bulkDeleteActivities(ids: string[])` que faz soft-delete via `update({ deleted_at: now() })` em batch (mais eficiente que N requests).

### FASE 4 — Validação
- Carregar `/app/activities`, verificar que dropdown não tem mais "Conta Teste" e usuários inativos.
- Clicar em cada badge (Atrasadas, Hoje, Essa Semana, Esse Mês, Planejadas) e confirmar que `total` da paginação = número do badge.
- Selecionar 3 atividades, clicar "Excluir selecionadas", confirmar, validar que somem da lista e que badges atualizem.

### Arquivos editados (~6)
1. `src/services/supabase/activities.ts` — reconciliar `getActivityStats` + adicionar `bulkDeleteActivities`
2. `src/pages/Activities.tsx` — filtro de membros ativos + estado de seleção + handler bulk delete
3. `src/components/activities/ActivityTable.tsx` — checkboxes e seleção
4. `src/components/activities/ActivityCard.tsx` — checkbox mobile
5. `src/components/activities/BulkActionsBar.tsx` (novo) — barra de ações em massa
6. `src/components/activities/FilterBar.tsx` — sem mudança (só recebe stats já reconciliados)

### Tempo: ~25 min

### Resultado esperado
- Dropdown "Vendedor" mostra só usuários ativos da org (sem "Conta Teste" etc.)
- Badge "Atrasadas 1161" → clica → lista mostra "de 1161 atividades" ✅
- Badge "Planejadas 1168" → clica → lista mostra "de 1168 atividades" ✅ (hoje mostra 5 errado)
- Badge "Esse Mês 410" → clica → lista mostra "de 410 atividades" ✅
- Checkbox no header seleciona página inteira; checkbox por linha seleciona individual
- Barra "X selecionada(s) — Excluir selecionadas" aparece com seleção ≥ 1
- Confirmação via AlertDialog antes de excluir
- Toast final + recarrega lista + atualiza badges

