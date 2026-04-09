

## Diagnóstico Forense: Por que o Lead Sourcing dá erro

### Causa raiz identificada: CORS bloqueado por JWT

O erro no console é claro:
```
Access to fetch at '.../functions/v1/lead-sourcing' from origin 'https://crm.humanoid-os.ai' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**A função `lead-sourcing` NÃO está listada no `supabase/config.toml`**, o que significa que ela usa o padrão `verify_jwt = true`. Quando o Supabase Gateway recebe o preflight `OPTIONS`, ele rejeita a request **antes** de ela chegar ao código da função — e portanto os CORS headers nunca são retornados ao browser.

### Problema secundário: CORS headers incompletos

Mesmo após corrigir o JWT, os headers CORS atuais estão incompletos:
```typescript
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
```
Faltam headers que o Supabase JS client envia (`x-supabase-client-platform`, etc.), o que pode causar falhas em browsers mais restritivos.

### Plano de correção

**1. Adicionar `lead-sourcing` ao `config.toml` com `verify_jwt = false`**
- Isso permite que o preflight OPTIONS passe e o CORS funcione
- A autenticação já é feita em código (lê o Authorization header e valida o user)

**2. Atualizar CORS headers na função**
- Usar o set completo de headers que o Supabase JS client envia

**3. Redeploy da função**

### Arquivos alterados
- `supabase/config.toml` — adicionar bloco `[functions.lead-sourcing]`
- `supabase/functions/lead-sourcing/index.ts` — atualizar `corsHeaders`

