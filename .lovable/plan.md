

# Corrigir Dados do Modal de Celebração, Notificações e Slack

## Causa Raiz

Dois bugs críticos na Edge Function `post-acceptance-effects`:

1. **Seller = "Equipe"**: A query busca `profiles` com `.eq("id", owner_user_id)` mas o campo correto é `.eq("user_id", owner_user_id)`. Além disso, busca `first_name, last_name` que não existem — o campo correto é `full_name`.

2. **Account = "Cliente"**: O fallback `"Cliente"` está sendo usado porque a query de account pode falhar silenciosamente com `maybeSingle`. A lógica precisa ser mais robusta.

3. **Cor do modal**: O modal usa classes CSS genéricas. Deve puxar `primary_color` da tabela `organizations` (atualmente `#020cbc`).

## Alterações

### 1. `supabase/functions/post-acceptance-effects/index.ts`

**Corrigir query do vendedor (linha 104):**
```typescript
// DE:
.select("first_name, last_name")
.eq("id", opportunity.owner_user_id)
.maybeSingle();
sellerName = [sellerProfile.first_name, sellerProfile.last_name].filter(Boolean).join(" ")

// PARA:
.select("full_name")
.eq("user_id", opportunity.owner_user_id)
.maybeSingle();
sellerName = sellerProfile.full_name || "Equipe"
```

**Blindar query da conta (linhas 88-97):**
- Adicionar log para debug
- Garantir que `account_id` existe antes da query
- Usar `single()` em vez de `maybeSingle` quando `account_id` é conhecido

**Também buscar `primary_color` da organization** para incluir no metadata da notificação, permitindo o modal usar a cor da empresa.

### 2. `src/components/notifications/DealWonCelebrationModal.tsx`

- Usar `metadata.primary_color` para estilizar o troféu e o botão CTA
- Fallback para a cor padrão do sistema se não houver cor configurada

### 3. `src/components/CelebrationProvider.tsx`

- Sem alterações necessárias — o provider já repassa a notification inteira para o modal

## Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/post-acceptance-effects/index.ts` | Corrigir queries de seller e account, adicionar `primary_color` no metadata |
| `src/components/notifications/DealWonCelebrationModal.tsx` | Usar `primary_color` do metadata para estilizar o modal |

## Resultado

- Vendedor: "Wagner Sansevero" (em vez de "Equipe")
- Cliente: "TRISUL LITCHI..." (em vez de "Cliente")
- Slack: mesmos dados corretos
- Modal: cor do troféu e botões usando a cor da empresa (#020cbc)

