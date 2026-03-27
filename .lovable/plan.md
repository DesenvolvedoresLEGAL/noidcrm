

## API REST para Sincronização de Produtos com Human ERP

### Contexto
O NoID CRM precisa de uma API REST pública (autenticada por API key) que permita ao Human ERP consultar e enviar produtos/serviços. Atualmente a tabela `products` não tem campo para mapear o ID externo do ERP, o que é essencial para sincronização sem duplicatas.

### O que será feito

#### 1. Migração: Adicionar campos de sincronização na tabela `products`

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id TEXT,        -- ID do produto no ERP
  ADD COLUMN IF NOT EXISTS external_source TEXT DEFAULT 'manual',  -- 'manual', 'human_erp', 'api'
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_products_external_id_org 
  ON public.products(organization_id, external_source, external_id) 
  WHERE external_id IS NOT NULL;
```

#### 2. Migração: Tabela `api_keys` para autenticação da API

```sql
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,           -- Ex: "Human ERP - Produção"
  key_hash TEXT NOT NULL,       -- SHA-256 do token
  key_prefix TEXT NOT NULL,     -- Primeiros 8 chars para identificação
  scopes TEXT[] DEFAULT '{}',   -- Ex: ['products:read', 'products:write']
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
```

Com RLS para que apenas admins da organização gerenciem as chaves.

#### 3. Edge Function: `api-products`

Uma única edge function RESTful que roteia por método HTTP:

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `?action=list` | Lista todos os produtos da org (com filtros opcionais) |
| `GET` | `?action=get&id=xxx` | Busca produto por ID ou external_id |
| `POST` | `action=upsert` | Cria ou atualiza produto (upsert por external_id) |
| `POST` | `action=bulk_upsert` | Upsert em lote (até 100 produtos por request) |

**Autenticação**: Header `X-API-Key: noid_xxxxx...` → valida hash contra tabela `api_keys`, extrai `organization_id`.

**Exemplo de payload (upsert)**:
```json
{
  "action": "upsert",
  "data": {
    "external_id": "PROD-001",
    "name": "Speedy Internet 100MB",
    "type": "servico",
    "price": 199.90,
    "cost": 50.00,
    "code": "SPD100",
    "unit": "un",
    "active": true
  }
}
```

**Exemplo de payload (bulk_upsert)**:
```json
{
  "action": "bulk_upsert",
  "items": [
    { "external_id": "PROD-001", "name": "Speedy 100MB", "price": 199.90 },
    { "external_id": "PROD-002", "name": "Speedy 200MB", "price": 299.90 }
  ]
}
```

**Resposta padrão**:
```json
{
  "success": true,
  "data": { ... },
  "synced_at": "2026-03-27T13:00:00Z"
}
```

#### 4. Edge Function: `api-keys-manage`

Função interna (autenticada por JWT do usuário logado) para o admin gerar/revogar API keys pela interface do NoID CRM.

#### 5. UI: Página de gerenciamento de API Keys

Em **Configurações**, uma nova aba ou seção para:
- Gerar nova API key (mostra o token completo apenas uma vez)
- Listar keys ativas com nome, prefixo, escopos, último uso
- Revogar keys

---

### Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `api_keys` + campos `external_id` em `products` |
| `supabase/functions/api-products/index.ts` | Nova edge function REST |
| `supabase/functions/api-keys-manage/index.ts` | Nova edge function para CRUD de keys |
| `src/pages/settings/ApiKeysSettings.tsx` | Nova página de gerenciamento |
| `src/App.tsx` | Adicionar rota `/configuracoes/api` |

### Segurança
- API keys são armazenadas como hash SHA-256 (nunca em texto plano)
- Cada key é vinculada a uma organização e tem escopos granulares
- Rate limiting básico via headers
- Validação de input com Zod em todos os endpoints
- A edge function usa `service_role` key para bypass de RLS, mas filtra por `organization_id` da API key

### Extensibilidade futura
Esta mesma estrutura de `api_keys` + `external_id` será reaproveitada para sincronizar vendas, clientes, contatos etc. com o Human ERP quando tivermos acesso à API deles.

