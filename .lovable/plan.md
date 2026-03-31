

# Sincronizar desativação de usuários entre organization_members e sellers

## Problema
Quando um usuário é bloqueado/removido no CRM (via configurações de usuários), apenas `organization_members.status` muda para `'suspended'`. A tabela `sellers` continua com `active = true`, fazendo o usuário aparecer no ranking, relatórios, roleplay, etc.

## Solução

### 1. Migration SQL — Trigger automático + limpeza do João Parolini

**Trigger**: Criar uma função + trigger no banco que, sempre que `organization_members.status` mudar para `'suspended'`, automaticamente seta `sellers.active = false` para o `user_id` correspondente na mesma `organization_id`. E quando voltar para `'active'`, reativa o seller.

Também definir `end_date` em `ote_seller_config` quando o seller é desativado (padrão soft-delete do OTE).

**Limpeza imediata**: Desativar o seller do João Parolini (`user_id = '0a33e0ba-ee0b-49c3-8ddf-898487c38ec5'`).

### 2. `src/components/settings/UsersContent.tsx` — Feedback visual
Nenhuma mudança de código necessária no frontend — o trigger cuida de tudo no banco. Opcionalmente, invalidar cache de `sellers` e `leaderboard` após bloquear.

## Resultado
- João Parolini some imediatamente do ranking
- Qualquer futuro bloqueio/desbloqueio de usuário sincroniza automaticamente o status do seller
- Rankings, relatórios OTE, roleplay, e qualquer query que filtre `sellers.active = true` ficam consistentes

## Arquivos
1. Migration SQL (trigger `sync_seller_active_on_member_status` + desativar João Parolini)

