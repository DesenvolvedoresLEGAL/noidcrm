

## Análise Forense Completa: "Nenhuma atividade encontrada" no UserActivityReport

### 1. PROBLEMA IDENTIFICADO

O relatório `/admin/users/activity` mostra "0 registros" e "Nenhuma atividade encontrada no período" ao selecionar OPERADORA LEGAL, mesmo havendo **2.978 registros** no banco de dados para essa organização.

### 2. CAUSA RAIZ

**A política de RLS `Users can view org audit logs` na tabela `audit_log` impede que o Super Admin veja dados de outras organizações.**

```sql
-- POLÍTICA ATUAL (restritiva demais):
CREATE POLICY "Users can view org audit logs" ON audit_log 
  FOR SELECT 
  USING (organization_id = get_user_organization_id());
```

**Evidências:**
| Dado | Valor |
|------|-------|
| Usuário logado | fala@humanoid-os.ai (Wagner) |
| É Platform Admin? | SIM (tabela `platform_admins`) |
| Organização do usuário | HUMANOID (id: `774d7d78-...`) |
| Organização selecionada | OPERADORA LEGAL (id: `d1b68a0f-...`) |
| Registros HUMANOID últimos 30d | 164 |
| Registros OPERADORA LEGAL últimos 30d | 2.978 |

**O que acontece:** `get_user_organization_id()` retorna `774d7d78-...` (HUMANOID), então a política RLS filtra apenas `WHERE organization_id = '774d7d78-...'`, ignorando completamente os 2.978 registros de OPERADORA LEGAL.

### 3. POR QUE OUTRAS TABELAS FUNCIONAM

Outras tabelas como `organizations`, `profiles`, `opportunities` têm políticas adicionais:

```sql
-- EXEMPLO (opportunities):
CREATE POLICY "Platform admins can view all opportunities" 
ON opportunities FOR SELECT TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));
```

**A tabela `audit_log` NÃO TEM essa política de bypass para platform admins.**

### 4. SOLUÇÃO PROPOSTA

#### 4.1 Migration SQL: Adicionar política de SELECT para Platform Admins

```sql
-- Permitir que platform admins vejam audit_log de TODAS as organizações
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_log;
CREATE POLICY "Platform admins can view all audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()));
```

Esta nova política funciona em conjunto com a existente via lógica OR (padrão PERMISSIVE):
- Usuário normal → vê apenas `organization_id = get_user_organization_id()`
- Platform Admin → vê TODAS as organizações (via `is_platform_admin_for_rls`)

#### 4.2 Ajustar o Frontend para Melhor Debug

Adicionar tratamento de erro explícito e log de debug no `UserActivityReport.tsx`:

```typescript
// Após a query de auditData
console.log('[UserActivityReport] auditData count:', auditData?.length);
if (auditError) {
  console.error('[UserActivityReport] Query error:', auditError);
  throw auditError;
}
```

#### 4.3 Adicionar Indicador de Permissão no UI

Mostrar ao usuário quando a consulta retornar vazia se ele tem permissão de platform admin ou não:

```tsx
{activityData?.length === 0 && (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Nenhuma atividade encontrada no período</p>
    <p className="text-xs text-muted-foreground mt-2">
      Verifique se você tem permissão para visualizar dados desta organização.
    </p>
  </div>
)}
```

### 5. ARQUIVOS A MODIFICAR

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/XXXXXX_fix_audit_log_platform_admin.sql` | Nova migration com política RLS |
| `src/pages/admin/UserActivityReport.tsx` | Melhor tratamento de erros e indicadores |

### 6. VALIDAÇÃO PÓS-FIX

Após aplicar a migration:

```sql
-- Teste: Platform admin deve conseguir ver registros de OPERADORA LEGAL
SET request.jwt.claims = '{"sub":"6d3df423-f210-4857-82d5-b068abdce96d"}';
SELECT COUNT(*) FROM audit_log WHERE organization_id = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d';
-- Esperado: 2978 (não 0)
```

### 7. IMPACTO

- **Segurança**: Mantida - apenas platform admins ativos podem ver cross-org
- **Performance**: Nenhum impacto - usa função já indexada
- **Funcionalidade**: Relatório de atividade funcionará corretamente para Super Admins

### 8. DETALHES TÉCNICOS DA IMPLEMENTAÇÃO

A migration SQL será:

```sql
-- Migration: Fix audit_log RLS for platform admins
-- Problema: Platform admins não conseguem ver audit_log de outras organizações
-- Solução: Adicionar política PERMISSIVE de SELECT para platform admins

-- Verificar se a função existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin_for_rls') THEN
    RAISE EXCEPTION 'Function is_platform_admin_for_rls does not exist!';
  END IF;
END $$;

-- Adicionar política de bypass para platform admins
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_log;

CREATE POLICY "Platform admins can view all audit logs"
ON public.audit_log 
FOR SELECT
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()));

-- Adicionar comentário explicativo
COMMENT ON POLICY "Platform admins can view all audit logs" ON public.audit_log IS 
'Permite que platform admins vejam audit_log de todas as organizações para fins de auditoria e compliance.';
```

O frontend será atualizado para mostrar melhor feedback quando não houver dados, distinguindo entre "sem permissão" e "realmente sem dados".

