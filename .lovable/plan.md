
## Integração: Enviar proposta aceita para o Umma ERP — IMPLEMENTADO

### O que foi criado

#### 1. Edge function `api-deals`
Arquivo: `supabase/functions/api-deals/index.ts`
- Autenticação via `X-API-Key` (mesmo padrão `api-products`)
- `?action=list&status=won` → lista propostas aceitas com dados completos
- `?action=get&id=xxx` → retorna uma proposta específica
- Formato flatten com company, contact, products e payment_terms

#### 2. Edge function `notify-deal-won`
Arquivo: `supabase/functions/notify-deal-won/index.ts`
- Recebe `proposal_id`
- Busca todos os dados (proposta + oportunidade + conta + contato + itens + pagamento)
- Formata no padrão ERP
- POST para o Umma ERP com `X-API-Key`

#### 3. Webhook automático na aceitação
- `acceptProposal()` em `src/services/supabase/proposals.ts` agora dispara `notify-deal-won` fire-and-forget após marcar a proposta como aceita

### Secrets configurados
- `UMMA_ERP_API_KEY`
- `UMMA_ERP_WEBHOOK_URL`

### Teste da API
```bash
curl -H "X-API-Key: SUA_KEY" "https://urihdqturaebhiefwjnw.supabase.co/functions/v1/api-deals?action=list&status=won"
```
