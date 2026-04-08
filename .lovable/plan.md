

## Diagnostico Forense: Problemas de Atualizacao em Tempo Real no CRM

### Causa Raiz

Foram identificados **3 problemas estruturais** que causam a necessidade de hard refresh:

---

### Problema 1: Kanban (Opportunities.tsx) usa useState manual, sem React Query

A pagina principal do Kanban (`src/pages/Opportunities.tsx`) carrega oportunidades via `useState` + `loadData()` manual. Nao usa React Query, entao:
- Nao ha cache compartilhado com outras paginas
- Quando um workflow duplica uma oportunidade para outro funil, nada dispara `loadData()` novamente
- Nao existe nenhuma subscription Realtime para a tabela `opportunities`

### Problema 2: Edicao de conta nao invalida cache da oportunidade

Quando o usuario edita uma conta via `AccountEditor.tsx`, o `onSuccess` invalida `['accounts']` e `['account-details', id]`, mas **NAO invalida** `['opportunity', oppId]`. Como os dados da conta (CNPJ, telefones, etc.) sao carregados junto com a oportunidade via join no `useOpportunityDetails`, os dados ficam stale ate o hard refresh.

### Problema 3: Tabela `opportunities` nao tem Realtime habilitado

As migrations mostram Realtime habilitado para `notifications`, `proposal_views`, `onboarding_status`, etc. Mas **`opportunities`, `accounts` e `contacts` NAO estao** na publicacao `supabase_realtime`.

---

### Plano de Correcao

**1. Migrar Kanban para React Query + Realtime** (`src/pages/Opportunities.tsx`)
- Substituir `useState` + `loadData()` por `useQuery` com queryKey `['opportunities']`
- Manter a logica de filtro existente no lado do cliente
- Adicionar um hook `useRealtimeOpportunities` que escuta `postgres_changes` na tabela `opportunities` e chama `queryClient.invalidateQueries({ queryKey: ['opportunities'] })` em INSERT/UPDATE/DELETE

**2. Criar hook `useRealtimeOpportunities`** (`src/hooks/useRealtimeOpportunities.ts`)
- Subscription Realtime na tabela `opportunities` para eventos INSERT, UPDATE, DELETE
- Invalida queryKey `['opportunities']` automaticamente
- Seguir mesmo padrao dos hooks existentes (`useNotifications`, `useDeletionAlerts`)

**3. Invalidar cache de oportunidade ao editar conta/contato**
- Em `AccountEditor.tsx` e `AccountModalTabs.tsx`: adicionar `queryClient.invalidateQueries({ queryKey: ['opportunities'] })` no `onSuccess` da mutation de update
- Em `ContactModal.tsx`: mesmo tratamento
- Isso garante que ao voltar para o Kanban ou detalhe da oportunidade, os dados estejam frescos

**4. Migration: Habilitar Realtime para tabelas core**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
```

**5. Adicionar Realtime no detalhe da oportunidade** (`src/hooks/useOpportunityDetails.ts` ou `OpportunityDetail.tsx`)
- Subscription para changes na oportunidade especifica (filtro por `id`)
- Subscription para changes em `accounts` e `contacts` vinculados
- Invalida `['opportunity', id]` ao receber evento

### Arquivos a editar
- `src/pages/Opportunities.tsx` — migrar para React Query + Realtime
- `src/hooks/useRealtimeOpportunities.ts` — novo hook
- `src/pages/AccountEditor.tsx` — invalidar `['opportunities']`
- `src/components/accounts/AccountModalTabs.tsx` — invalidar `['opportunities']`
- `src/components/contacts/ContactModal.tsx` — invalidar `['opportunities']`
- `src/pages/OpportunityDetail.tsx` — adicionar Realtime subscription
- Migration SQL — habilitar Realtime para `opportunities`, `accounts`, `contacts`

### Resultado esperado
- Oportunidades duplicadas por workflow aparecem automaticamente no Kanban sem refresh
- Edicoes de conta/contato refletem imediatamente no card da empresa na oportunidade
- Qualquer alteracao feita por outro usuario ou automacao aparece em tempo real

