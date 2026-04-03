

## Diagnóstico e Plano de Correção

### Problema
O ERP tem o score financeiro da Baselinker (50, Risco Alto), mas o CRM mostra "Sem score" porque **nenhum webhook foi recebido** — zero chamadas à `api-accounts` nos logs.

### Causa Raiz
A sincronização é push-only (webhook). O ERP precisa estar configurado para disparar `POST` ao CRM, mas isso aparentemente não foi feito ou não está funcionando.

### Plano: Adicionar Sincronização Pull (CRM puxa do ERP)

Para não depender 100% do ERP enviar webhooks, vamos implementar um **botão "Sincronizar com ERP"** na aba Financeiro + um mecanismo de pull:

#### 1. Criar Edge Function `sync-account-from-erp`
- Recebe `account_id` ou `cnpj` do CRM
- Faz GET na API do ERP (`account-data?document=CNPJ`) usando a API key do ERP
- Atualiza os campos financeiros da conta no CRM
- Registra no audit_log

#### 2. Adicionar botão "Sincronizar" na aba Financeiro
- Botão no `AccountFinancialTab` que chama a nova edge function
- Mostra loading state e feedback (toast) de sucesso/erro
- Exibe a data da última sincronização (`erp_sync_at`)

#### 3. Configurar secret da API do ERP
- Adicionar `HUMAN_ERP_API_KEY` e `HUMAN_ERP_BASE_URL` como secrets
- Usados pela edge function para autenticar no ERP

#### 4. Melhorar visibilidade do status de sync
- Na aba Financeiro, mostrar claramente se os dados vieram do ERP ou não
- Mostrar timestamp da última sincronização
- Mostrar estado "Nunca sincronizado" quando `erp_sync_at` é null

### Arquivos Afetados
- **Criar:** `supabase/functions/sync-account-from-erp/index.ts`
- **Editar:** `src/components/accounts/AccountFinancialTab.tsx` (botão sync)

### Sobre Cron vs Webhook
A arquitetura atual é webhook-only. Com este plano, teremos **ambos**:
- **Push (webhook):** ERP envia quando houver mudança (tempo real)
- **Pull (sob demanda):** Usuário clica "Sincronizar" no CRM para buscar dados atualizados

Se quiser, futuramente podemos adicionar um cron (pg_cron) para sincronizar periodicamente todas as contas.

