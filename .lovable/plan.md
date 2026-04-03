

## Plano: Excluir Usuários com Transferência Obrigatória de Dados

### Resumo
Adicionar botão "Excluir" na listagem de usuários, com modal obrigatório de transferência de registros para outro usuário antes da exclusão. Criar aba "Excluídos" para visualizar histórico.

### 1. Criar Edge Function `delete-user-with-transfer`

Nova função em `supabase/functions/delete-user-with-transfer/index.ts` que:
- Recebe `user_id_to_delete`, `transfer_to_user_id`, `organization_id`
- Valida que ambos os usuários pertencem à mesma organização
- Transfere **todos os registros** do usuário para o novo proprietário:
  - `opportunities.owner_user_id` e `opportunities.created_by`
  - `accounts.owner_user_id`, `accounts.created_by`, `accounts.cs_user_id`
  - `activities.owner_user_id`
  - `contracts.owner_user_id`
  - `contacts` (se tiver owner)
  - `deal_participants.user_id`
  - `opportunity_notes.created_by`
  - `proposals` via `proposal_participants.user_id`
  - `team_members.user_id`
  - `sellers` (desativa o seller do usuário excluído)
  - `ote_seller_config`, `sales_goals`, `seller_targets`
- Marca o membro como `status = 'deleted'` em `organization_members`
- Registra no `audit_log` a ação e a transferência
- **Não** exclui o auth user (apenas remove da organização)

### 2. Migration: Adicionar status 'deleted' ao organization_members

O campo `status` já aceita texto livre. Vamos usar `'deleted'` como novo valor. Adicionar coluna `deleted_at` e `deleted_by` ao `organization_members` para rastreio.

```sql
ALTER TABLE organization_members 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS transferred_to uuid;
```

### 3. Criar componente `DeleteUserModal`

Novo componente em `src/components/users/DeleteUserModal.tsx`:
- Modal com aviso claro sobre a exclusão permanente
- **Select obrigatório** para escolher o usuário que receberá os registros
- Lista todos os membros ativos da organização (exceto o que será excluído)
- Resumo dos registros que serão transferidos (contagem por tipo)
- Botão "Excluir e Transferir" com confirmação por digitação do nome
- Loading state durante a operação

### 4. Atualizar `UsersContent.tsx`

- Adicionar botão de excluir (ícone Trash2) ao lado do botão de bloquear nas ações
- Adicionar nova aba **"Excluídos"** entre "Inativos" e "Aguardando" (total: 5 tabs)
- Na aba Excluídos: mostrar usuário, e-mail, permissão, data exclusão, transferido para
- Ajustar `fetchData` para buscar `status = 'deleted'` na nova aba
- Importar e usar o `DeleteUserModal`

### Arquivos Afetados
- **Criar:** `supabase/functions/delete-user-with-transfer/index.ts`
- **Criar:** `src/components/users/DeleteUserModal.tsx`
- **Editar:** `src/components/settings/UsersContent.tsx`
- **Migration:** Adicionar colunas `deleted_at`, `deleted_by`, `transferred_to` em `organization_members`

