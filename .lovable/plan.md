

## Correção: Tracking Completo de Sessões de Usuário

### Problema Identificado

O sistema de auditoria de autenticação (`auth_audit_log`) reporta informações **incorretas** sobre último login porque:

1. **Sessões persistentes não são rastreadas** - O token refresh automático do Supabase não é capturado
2. **Retorno de sessão não é rastreado** - Quando usuário volta ao app com sessão ativa no localStorage, não há registro
3. **Discrepância grave** - Leonardo aparece com "último login: 14/01" mas está ativo TODOS OS DIAS

**Dados atuais do Leonardo:**
- `auth_audit_log`: último login 14/01/2026 (incorreto)
- `audit_log`: 12 ações em 30/01, 17 em 29/01, 34 em 28/01... (correto)

### Solução Proposta

Implementar tracking de sessão em dois níveis:

#### 1. Adicionar evento `session_refresh` no `onAuthStateChange`

Modificar `useSupabaseAuth.ts` para capturar eventos de sessão:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // NOVO: Track session events
      if (session?.user && event === 'SIGNED_IN') {
        // Verificar se é login real ou token refresh
        const lastLoginKey = `last_login_tracked_${session.user.id}`;
        const lastTracked = localStorage.getItem(lastLoginKey);
        const now = Date.now();
        
        // Se passou mais de 1 hora desde último track, registrar
        if (!lastTracked || (now - parseInt(lastTracked)) > 3600000) {
          trackAuthEvent('session_refresh', session.user.email!, session.user.id, true);
          localStorage.setItem(lastLoginKey, now.toString());
        }
      }
    }
  );
  
  return () => subscription.unsubscribe();
}, [trackAuthEvent]);
```

#### 2. Criar função para obter "último acesso real"

Nova função que consulta a última atividade REAL do usuário:

```typescript
// src/services/supabase/user-activity.ts
export async function getLastUserActivity(email: string): Promise<{
  lastLogin: Date | null;
  lastActivity: Date | null;
  isActive: boolean;
}> {
  // Consulta auth_audit_log para último login
  const { data: authLog } = await supabase
    .from('auth_audit_log')
    .select('created_at')
    .eq('email', email)
    .in('event_type', ['login', 'session_refresh'])
    .eq('success', true)
    .order('created_at', { ascending: false })
    .limit(1);
  
  // Consulta audit_log para última atividade real
  const { data: activityLog } = await supabase
    .from('audit_log')
    .select('created_at, actor:profiles!actor_user_id(user_id)')
    .eq('actor.user_id', (await getUserIdByEmail(email)))
    .order('created_at', { ascending: false })
    .limit(1);
  
  return {
    lastLogin: authLog?.[0]?.created_at,
    lastActivity: activityLog?.[0]?.created_at,
    isActive: isWithinLast24Hours(activityLog?.[0]?.created_at)
  };
}
```

#### 3. Adicionar coluna `event_type` para `session_refresh`

O sistema já suporta, basta documentar os tipos:
- `login` - Login com senha
- `logout` - Logout explícito
- `signup` - Novo cadastro
- `failed_login` - Tentativa falha
- `password_reset` - Reset de senha
- `session_refresh` - **NOVO** - Token refresh ou retorno de sessão

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSupabaseAuth.ts` | Adicionar tracking de `session_refresh` no `onAuthStateChange` |
| `src/services/supabase/user-activity.ts` | **NOVO** - Função para obter último acesso real |
| Página de usuários (admin) | Mostrar "Último Acesso" baseado em `audit_log` além de "Último Login" |

### Workaround Imediato

Enquanto a correção não é implementada, para saber a atividade REAL de um usuário, usar:

```sql
-- Último acesso REAL do usuário (baseado em ações)
SELECT DATE(created_at) as activity_date, COUNT(*) as actions
FROM audit_log
WHERE actor_user_id = (
  SELECT user_id FROM profiles WHERE email = 'leonardo@operadora.legal'
)
GROUP BY DATE(created_at)
ORDER BY activity_date DESC
LIMIT 10;
```

### Impacto

- **Segurança**: Visibilidade completa de sessões ativas
- **Confiabilidade**: Dados de atividade confiáveis para decisões de negócio
- **Compliance**: Audit trail completo para LGPD/auditoria

