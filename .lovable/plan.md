

## Integração: Enviar proposta aceita para o Umma ERP

### Contexto
O NoID CRM não tem tabelas `deals`, `companies` nem `deal_products`. A estrutura real é:
- `proposals` (com status `accepted`)
- `proposal_items` (itens da proposta)
- `proposal_payment_terms` (condições de pagamento)
- `opportunities` (oportunidade vinculada)
- `accounts` (conta/empresa do cliente)
- `contacts` (contato do cliente)

Os arquivos enviados (`noId-crm-api-deals.ts` e `noId-crm-migration-deals.sql`) são templates para outro schema. Vou adaptá-los para o schema real do NoID CRM.

### O que será criado

#### 1. Edge function `api-deals` (adaptada ao schema real)
Arquivo: `supabase/functions/api-deals/index.ts`

- **Autenticação**: via `X-API-Key` usando o mesmo sistema de `api_keys` com hash SHA-256 (padrão `api-products`)
- **`?action=list`**: lista propostas aceitas com dados completos
  - Filtro opcional `?status=won` → busca `proposals` com `status = 'accepted'`
  - Retorna dados flatten no formato esperado pelo ERP:
    - dados da proposta (id, título da oportunidade, valor total, validade)
    - dados da conta/empresa (razao_social, cnpj, email, telefone)
    - dados do contato (nome, email, telefone)
    - itens da proposta (nome, preço, quantidade, billing_type, minimum_contract_months)
    - condições de pagamento (payment_type, installments, contract_duration_months, etc.)
- **`?action=get&id=xxx`**: retorna uma proposta específica no mesmo formato

Mapeamento de campos para o ERP:
```text
deal.id           → proposal.id
deal.title        → opportunity.title
deal.amount       → proposal total (soma dos itens)
deal.status       → 'won' (quando proposal.status = 'accepted')
deal.won_date     → proposal.accepted_at
deal.company_*    → accounts.razao_social, accounts.cnpj, etc.
deal.contact_*    → contacts.name, contacts.email, etc.
deal.products[]   → proposal_items (name, unit_price, quantity, billing_type)
```

#### 2. Webhook automático na aceitação da proposta
- Modificar `acceptProposal()` em `src/services/supabase/proposals.ts` para, após marcar a proposta como aceita, disparar um POST para o Umma ERP:
  - URL: `https://ipkfufivmtodhiykoerz.supabase.co/functions/v1/sync-deals?action=webhook`
  - Header: `X-API-Key`
  - Body: dados da proposta aceita no formato flatten do ERP
- O disparo será feito via uma nova edge function `notify-deal-won` que:
  - Recebe o `proposal_id`
  - Busca todos os dados (proposta + oportunidade + conta + contato + itens + pagamento)
  - Formata no padrão ERP
  - Faz POST para o endpoint do Umma ERP
  - Registra sucesso/falha em log

#### 3. Secret necessário
- `UMMA_ERP_API_KEY`: chave de API do Umma ERP para autenticação no webhook
- `UMMA_ERP_WEBHOOK_URL`: URL do endpoint de destino (default: `https://ipkfufivmtodhiykoerz.supabase.co/functions/v1/sync-deals?action=webhook`)

#### 4. Não será criada migration de tabelas novas
- O schema do NoID CRM já tem todas as tabelas necessárias (`proposals`, `proposal_items`, `proposal_payment_terms`, `accounts`, `contacts`, `opportunities`)
- Não é necessário criar `deals` nem `deal_products`
- A `api-deals` é apenas uma camada de leitura/tradução sobre o schema existente

### Arquivos impactados
- `supabase/functions/api-deals/index.ts` — **novo** (endpoint REST)
- `supabase/functions/notify-deal-won/index.ts` — **novo** (webhook para ERP)
- `src/services/supabase/proposals.ts` — **editar** (chamar webhook após aceitação)

### Fluxo completo
```text
Cliente aceita proposta no link público
  → acceptProposal() atualiza status para 'accepted'
  → dispara edge function notify-deal-won
    → busca dados completos da proposta
    → formata no padrão ERP (flatten)
    → POST para Umma ERP com X-API-Key
    → ERP cria cobrança automaticamente
```

### Formato de resposta da API
```json
{
  "success": true,
  "data": [{
    "id": "uuid-da-proposta",
    "title": "Nome da oportunidade",
    "amount": 5000.00,
    "status": "won",
    "won_date": "2026-03-27T14:00:00Z",
    "company_name": "Empresa XYZ",
    "company_document": "12345678000100",
    "contact_name": "João",
    "contact_email": "joao@xyz.com",
    "products": [
      {
        "id": "uuid-item",
        "name": "Plano Pro",
        "price": 500.00,
        "quantity": 1,
        "billing_type": "recurring"
      }
    ],
    "payment_terms": {
      "payment_type": "recurring",
      "contract_duration_months": 12,
      "monthly_value": 500.00,
      "billing_day": 10
    }
  }]
}
```

