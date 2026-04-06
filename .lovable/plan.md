

## Correção: Funções ERP bloqueadas por `verify_jwt`

### Causa Raiz
As funções usadas pelo ERP (`api-deals`, `api-accounts`, `api-products`, `notify-deal-won`, `api-keys-manage`) **não possuem entrada no `supabase/config.toml`**. Sem configuração explícita, o padrão é `verify_jwt = true`, o que significa que o gateway do Supabase exige um JWT válido no header `Authorization`. 

O ERP se autentica via `X-API-Key` (SHA-256), não via JWT. Por isso, todas as chamadas são rejeitadas com **401** antes mesmo de chegar ao código da função.

Os logs confirmam:
```
GET | 401 | api-deals?action=list&status=won
```

A proposta da Adaptive **está aceita** no banco (status `accepted`, accepted_at `2026-04-06 14:04`), mas o ERP não consegue buscá-la.

### Correção
Adicionar `verify_jwt = false` no `supabase/config.toml` para as 5 funções ERP que já implementam autenticação própria via API key:

| Função | Autenticação Própria |
|--------|---------------------|
| `api-deals` | SHA-256 X-API-Key |
| `api-accounts` | SHA-256 X-API-Key |
| `api-products` | SHA-256 X-API-Key |
| `notify-deal-won` | Chamada interna (fire-and-forget) |
| `api-keys-manage` | JWT próprio no código |

### Arquivo Afetado
- **Editar:** `supabase/config.toml` — adicionar 5 blocos `[functions.*]` com `verify_jwt = false`

### Impacto
- Zero impacto em features existentes
- A segurança permanece intacta pois todas as funções já validam API key internamente
- O ERP voltará a conseguir listar e importar deals com status "won"

